<?php

declare(strict_types=1);

namespace QcmProxy;

use Throwable;

final class Application
{
    public static function run(Operation $operation, string $backendRoot): void
    {
        $requestId = self::requestId();
        SecurityHeaders::apply();
        header('X-QCM-Request-Id: ' . $requestId);

        try {
            $config = Config::fromEnvironment($backendRoot);
            $originPolicy = new OriginPolicy($config);
            if ($originPolicy->handlePreflight()) {
                return;
            }
            $originPolicy->enforceForRequest();

            if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
                header('Allow: POST, OPTIONS');
                throw new ApiException('METHOD_NOT_ALLOWED', 'Cette ressource accepte uniquement POST.', 405);
            }

            $clientAddress = ClientAddress::resolve($config);
            (new RateLimiter($config))->consume($clientAddress, $operation);

            $pdfRequest = (new RequestValidator($config))->read($operation);
            $payload = (new OpenAiPayloadFactory($config))->build($operation, $pdfRequest);
            $upstream = (new OpenAiResponsesClient($config))->create($payload, $requestId);
            $result = (new OpenAiResponseParser())->parse($upstream);

            ApiResponse::send(200, [
                'ok' => true,
                'request_id' => $requestId,
                'operation' => $operation->publicName(),
                'data' => $result->data,
                'meta' => $result->meta,
            ]);
        } catch (ApiException $exception) {
            self::logFailure($requestId, $operation, $exception->errorCode, $exception->httpStatus);
            ApiResponse::send($exception->httpStatus, [
                'ok' => false,
                'request_id' => $requestId,
                'error' => [
                    'code' => $exception->errorCode,
                    'message' => $exception->getMessage(),
                    'retryable' => $exception->retryable,
                ],
            ]);
        } catch (Throwable $exception) {
            self::logFailure($requestId, $operation, 'INTERNAL_ERROR', 500, $exception::class);
            ApiResponse::send(500, [
                'ok' => false,
                'request_id' => $requestId,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'Une erreur interne a empêché le traitement de la requête.',
                    'retryable' => false,
                ],
            ]);
        }
    }

    private static function requestId(): string
    {
        try {
            return bin2hex(random_bytes(16));
        } catch (Throwable) {
            return hash('sha256', uniqid('', true));
        }
    }

    private static function logFailure(
        string $requestId,
        Operation $operation,
        string $code,
        int $status,
        ?string $exceptionClass = null,
    ): void {
        // Ne jamais journaliser le corps PDF, le prompt, la clé API ou la réponse du modèle.
        $record = [
            'component' => 'qcm-proxy',
            'request_id' => $requestId,
            'operation' => $operation->value,
            'error_code' => $code,
            'http_status' => $status,
        ];
        if ($exceptionClass !== null) {
            $record['exception_class'] = $exceptionClass;
        }
        error_log(json_encode($record, JSON_UNESCAPED_SLASHES) ?: '{"component":"qcm-proxy","error_code":"LOG_ENCODING_FAILED"}');
    }
}
