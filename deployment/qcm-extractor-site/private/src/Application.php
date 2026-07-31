<?php

declare(strict_types=1);

namespace QcmProxy;

use Throwable;

final class Application
{
    public static function run(Operation $operation, string $backendRoot): void
    {
        $requestId = self::requestId();
        $bufferLevel = ob_get_level();
        ob_start();

        self::hardenPhpOutput();
        self::registerFatalHandler($requestId, $operation, $bufferLevel);

        SecurityHeaders::apply();
        header('X-QCM-Request-Id: ' . $requestId);

        try {
            $config = Config::fromEnvironment($backendRoot);
            self::configureExecutionLimit($config->phpMaxExecutionSeconds);

            $originPolicy = new OriginPolicy($config);
            if ($originPolicy->handlePreflight()) {
                self::discardBufferedOutput($bufferLevel);
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

            self::discardBufferedOutput($bufferLevel);
            ApiResponse::send(200, [
                'ok' => true,
                'request_id' => $requestId,
                'operation' => $operation->publicName(),
                'data' => $result->data,
                'meta' => $result->meta,
            ]);
        } catch (ApiException $exception) {
            self::logFailure($requestId, $operation, $exception->errorCode, $exception->httpStatus);
            self::discardBufferedOutput($bufferLevel);
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
            self::discardBufferedOutput($bufferLevel);
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

    private static function hardenPhpOutput(): void
    {
        @ini_set('display_errors', '0');
        @ini_set('display_startup_errors', '0');
        @ini_set('html_errors', '0');
        @ini_set('log_errors', '1');
    }

    private static function configureExecutionLimit(int $seconds): void
    {
        @ini_set('max_execution_time', (string) $seconds);
        if (function_exists('set_time_limit')) {
            @set_time_limit($seconds);
        }
    }

    private static function registerFatalHandler(
        string $requestId,
        Operation $operation,
        int $bufferLevel,
    ): void {
        register_shutdown_function(static function () use ($requestId, $operation, $bufferLevel): void {
            $error = error_get_last();
            if ($error === null || ApiResponse::wasSent()) {
                return;
            }

            $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR];
            if (!in_array((int) ($error['type'] ?? 0), $fatalTypes, true)) {
                return;
            }

            $message = is_string($error['message'] ?? null) ? $error['message'] : '';
            $isTimeout = stripos($message, 'maximum execution time') !== false;
            $code = $isTimeout ? 'PHP_EXECUTION_TIMEOUT' : 'PHP_FATAL_ERROR';
            $publicMessage = $isTimeout
                ? 'Le délai maximal d’exécution PHP a été atteint avant la fin de l’analyse.'
                : 'Le processus PHP a été interrompu par une erreur fatale.';

            self::logFailure($requestId, $operation, $code, 500, 'PHP_FATAL');
            self::discardBufferedOutput($bufferLevel);

            if (!headers_sent()) {
                SecurityHeaders::apply();
                header('X-QCM-Request-Id: ' . $requestId);
            }

            ApiResponse::send(500, [
                'ok' => false,
                'request_id' => $requestId,
                'error' => [
                    'code' => $code,
                    'message' => $publicMessage,
                    'retryable' => $isTimeout,
                ],
            ]);
        });
    }

    private static function discardBufferedOutput(int $targetLevel): void
    {
        while (ob_get_level() > $targetLevel) {
            @ob_end_clean();
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
