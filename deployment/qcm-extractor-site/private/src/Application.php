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
        @ignore_user_abort(true);
        self::registerFatalHandler($requestId, $operation, $bufferLevel);

        SecurityHeaders::apply();
        header('X-QCM-Request-Id: ' . $requestId);

        try {
            $config = Config::fromEnvironment($backendRoot);
            Diagnostics::configure($config->diagnosticLogPath);
            Diagnostics::write('request_started', [
                'request_id' => $requestId,
                'operation' => $operation->value,
                'php_sapi' => PHP_SAPI,
                'php_version' => PHP_VERSION,
            ]);

            self::configureExecutionLimit($config->phpMaxExecutionSeconds, $config->requestTimeoutSeconds);

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
            Diagnostics::write('pdf_validated', [
                'request_id' => $requestId,
                'operation' => $operation->value,
                'pdf_bytes' => strlen($pdfRequest->bytes),
            ]);

            $payload = (new OpenAiPayloadFactory($config))->build($operation, $pdfRequest);
            $upstream = (new OpenAiResponsesClient($config))->create($payload, $requestId);
            $result = (new OpenAiResponseParser())->parse($upstream);

            Diagnostics::write('request_completed', [
                'request_id' => $requestId,
                'operation' => $operation->value,
                'upstream_status' => $upstream->status,
            ]);
            self::discardBufferedOutput($bufferLevel);
            ApiResponse::send(200, [
                'ok' => true,
                'request_id' => $requestId,
                'operation' => $operation->publicName(),
                'data' => $result->data,
                'meta' => $result->meta,
            ]);
        } catch (ApiException $exception) {
            self::logFailure($requestId, $operation, $exception->errorCode, $exception->httpStatus, $exception::class, $exception->getMessage());
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
            self::logFailure($requestId, $operation, 'INTERNAL_ERROR', 500, $exception::class, $exception->getMessage());
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
        @ini_set('output_buffering', '1');
    }

    private static function configureExecutionLimit(int $seconds, int $upstreamTimeout): void
    {
        @ini_set('max_execution_time', (string) $seconds);
        if (function_exists('set_time_limit')) {
            @set_time_limit($seconds);
        }

        $effectiveRaw = ini_get('max_execution_time');
        $effective = is_string($effectiveRaw) && filter_var($effectiveRaw, FILTER_VALIDATE_INT) !== false
            ? (int) $effectiveRaw
            : null;

        Diagnostics::write('execution_limit_checked', [
            'configured_seconds' => $seconds,
            'effective_seconds' => $effective,
            'upstream_timeout_seconds' => $upstreamTimeout,
        ]);

        // 0 signifie « illimité ». Toute autre valeur doit laisser une marge au proxy
        // pour convertir les erreurs cURL et les réponses du fournisseur en JSON.
        if ($effective !== null && $effective !== 0 && $effective <= $upstreamTimeout + 5) {
            throw new ApiException(
                'PHP_TIME_LIMIT_TOO_LOW',
                "Le serveur PHP limite encore l’exécution à {$effective} secondes. Augmentez max_execution_time à au moins " . ($upstreamTimeout + 15) . ' secondes.',
                503,
                false,
            );
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
            $isMemory = stripos($message, 'allowed memory size') !== false;
            $code = $isTimeout ? 'PHP_EXECUTION_TIMEOUT' : ($isMemory ? 'PHP_MEMORY_EXHAUSTED' : 'PHP_FATAL_ERROR');
            $publicMessage = $isTimeout
                ? 'Le délai maximal d’exécution PHP a été atteint avant la fin de l’analyse.'
                : ($isMemory
                    ? 'La mémoire disponible pour PHP est insuffisante pour traiter ce document.'
                    : 'Le processus PHP a été interrompu par une erreur fatale.');

            self::logFailure($requestId, $operation, $code, 500, 'PHP_FATAL', $message);
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
        ?string $detail = null,
    ): void {
        // Ne jamais journaliser le corps PDF, le prompt, la clé API ou la réponse complète du modèle.
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

        Diagnostics::write('request_failed', [
            'request_id' => $requestId,
            'operation' => $operation->value,
            'error_code' => $code,
            'http_status' => $status,
            'exception_class' => $exceptionClass,
            'detail' => $detail !== null ? substr($detail, 0, 500) : null,
        ]);
    }
}
