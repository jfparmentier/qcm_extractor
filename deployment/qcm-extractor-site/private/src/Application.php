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

        self::prepare($requestId, $operation, $bufferLevel);

        try {
            $config = self::loadConfig($backendRoot, $requestId, $operation);
            self::configureExecutionLimit($config->phpMaxExecutionSeconds, $config->requestTimeoutSeconds);
            self::enforceOriginAndMethod($config, ['POST'], $bufferLevel);
            EmailAccess::requireAuthenticated($backendRoot);

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
            self::sendApiException($requestId, $operation, $exception, $bufferLevel);
        } catch (Throwable $exception) {
            self::sendUnexpectedException($requestId, $operation, $exception, $bufferLevel);
        }
    }

    public static function runBackgroundOperation(Operation $operation, string $action, string $backendRoot): void
    {
        $requestId = self::requestId();
        $bufferLevel = ob_get_level();
        ob_start();

        self::prepare($requestId, $operation, $bufferLevel);

        try {
            $config = self::loadConfig($backendRoot, $requestId, $operation);
            $networkTimeout = max($config->backgroundStartTimeoutSeconds, $config->backgroundPollTimeoutSeconds);
            self::configureExecutionLimit($config->phpMaxExecutionSeconds, $networkTimeout);
            self::enforceOriginAndMethod($config, ['POST'], $bufferLevel);
            EmailAccess::requireAuthenticated($backendRoot);

            match ($action) {
                'start' => self::startBackgroundOperation($operation, $config, $requestId, $bufferLevel),
                'status' => self::pollBackgroundOperation($operation, $config, $requestId, $bufferLevel),
                'cancel' => self::cancelBackgroundOperation($operation, $config, $requestId, $bufferLevel),
                default => throw new ApiException('METHOD_NOT_ALLOWED', 'Action asynchrone inconnue.', 404, false),
            };
        } catch (ApiException $exception) {
            self::sendApiException($requestId, $operation, $exception, $bufferLevel);
        } catch (Throwable $exception) {
            self::sendUnexpectedException($requestId, $operation, $exception, $bufferLevel);
        }
    }

    private static function startBackgroundOperation(
        Operation $operation,
        Config $config,
        string $requestId,
        int $bufferLevel,
    ): void {
        $clientAddress = ClientAddress::resolve($config);
        (new RateLimiter($config))->consume($clientAddress, $operation);

        $pdfRequest = (new RequestValidator($config))->read($operation);
        Diagnostics::write('pdf_validated', [
            'request_id' => $requestId,
            'operation' => $operation->value,
            'pdf_bytes' => strlen($pdfRequest->bytes),
        ]);

        $payload = (new OpenAiPayloadFactory($config))->build($operation, $pdfRequest);
        $payload['background'] = true;
        $upstream = (new OpenAiResponsesClient($config))->create(
            $payload,
            $requestId,
            $config->backgroundStartTimeoutSeconds,
        );
        $parser = new OpenAiResponseParser();
        $state = $parser->inspect($upstream);

        if ($state->status === 'completed') {
            $result = $parser->parse($upstream);
            self::discardBufferedOutput($bufferLevel);
            ApiResponse::send(200, [
                'ok' => true,
                'request_id' => $requestId,
                'operation' => $operation->publicName(),
                'status' => 'completed',
                'data' => $result->data,
                'meta' => $result->meta,
            ]);
            return;
        }

        if (!in_array($state->status, ['queued', 'in_progress'], true)) {
            $parser->parse($upstream);
        }

        $job = BackgroundJobToken::issue($state->id, $operation, $config);
        Diagnostics::write('background_job_started', [
            'request_id' => $requestId,
            'operation' => $operation->value,
            'provider_response_id' => $state->id,
            'provider_status' => $state->status,
            'expires_at' => $job['expires_at'],
        ]);
        self::discardBufferedOutput($bufferLevel);
        ApiResponse::send(202, self::pendingPayload($operation, $requestId, $state, $job, $config));
    }

    private static function pollBackgroundOperation(
        Operation $operation,
        Config $config,
        string $requestId,
        int $bufferLevel,
    ): void {
        $job = self::readJobToken($config);
        if ($job['operation'] !== $operation) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton ne correspond pas à cette opération.', 400, false);
        }

        $upstream = (new OpenAiResponsesClient($config))->retrieve($job['response_id'], $requestId);
        $parser = new OpenAiResponseParser();
        $state = $parser->inspect($upstream);

        if (in_array($state->status, ['queued', 'in_progress'], true)) {
            self::discardBufferedOutput($bufferLevel);
            ApiResponse::send(202, self::pendingPayload(
                $operation,
                $requestId,
                $state,
                [
                    'token' => trim((string) ($_SERVER['HTTP_X_QCM_JOB'] ?? '')),
                    'expires_at' => $job['expires_at'],
                ],
                $config,
            ));
            return;
        }

        $result = $parser->parse($upstream);
        Diagnostics::write('background_job_completed', [
            'request_id' => $requestId,
            'operation' => $operation->value,
            'provider_response_id' => $state->id,
        ]);
        self::discardBufferedOutput($bufferLevel);
        ApiResponse::send(200, [
            'ok' => true,
            'request_id' => $requestId,
            'operation' => $operation->publicName(),
            'status' => 'completed',
            'data' => $result->data,
            'meta' => $result->meta,
        ]);
    }

    private static function cancelBackgroundOperation(
        Operation $operation,
        Config $config,
        string $requestId,
        int $bufferLevel,
    ): void {
        $job = self::readJobToken($config);
        if ($job['operation'] !== $operation) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton ne correspond pas à cette opération.', 400, false);
        }

        $upstream = (new OpenAiResponsesClient($config))->cancel($job['response_id'], $requestId);
        $state = (new OpenAiResponseParser())->inspect($upstream);
        Diagnostics::write('background_job_cancelled', [
            'request_id' => $requestId,
            'operation' => $operation->value,
            'provider_response_id' => $state->id,
            'provider_status' => $state->status,
        ]);
        self::discardBufferedOutput($bufferLevel);
        ApiResponse::send(200, [
            'ok' => true,
            'request_id' => $requestId,
            'operation' => $operation->publicName(),
            'status' => $state->status,
        ]);
    }

    /** @return array{response_id:string,operation:Operation,expires_at:int} */
    private static function readJobToken(Config $config): array
    {
        $token = trim((string) ($_SERVER['HTTP_X_QCM_JOB'] ?? ''));
        if ($token === '') {
            throw new ApiException('MISSING_JOB_TOKEN', 'Le jeton de suivi est absent.', 400, false);
        }

        return BackgroundJobToken::verify($token, $config);
    }

    /**
     * @param array{token:string,expires_at:int} $job
     * @return array<string, mixed>
     */
    private static function pendingPayload(
        Operation $operation,
        string $requestId,
        BackgroundResponseState $state,
        array $job,
        Config $config,
    ): array {
        return [
            'ok' => true,
            'request_id' => $requestId,
            'operation' => $operation->publicName(),
            'status' => $state->status,
            'job' => [
                'token' => $job['token'],
                'expires_at' => $job['expires_at'],
                'poll_after_ms' => $config->backgroundPollIntervalMilliseconds,
            ],
            'meta' => $state->meta,
        ];
    }

    private static function prepare(string $requestId, Operation $operation, int $bufferLevel): void
    {
        self::hardenPhpOutput();
        @ignore_user_abort(true);
        self::registerFatalHandler($requestId, $operation, $bufferLevel);
        SecurityHeaders::apply();
        header('X-QCM-Request-Id: ' . $requestId);
    }

    private static function loadConfig(string $backendRoot, string $requestId, Operation $operation): Config
    {
        $config = Config::fromEnvironment($backendRoot);
        Diagnostics::configure($config->diagnosticLogPath);
        Diagnostics::write('request_started', [
            'request_id' => $requestId,
            'operation' => $operation->value,
            'php_sapi' => PHP_SAPI,
            'php_version' => PHP_VERSION,
        ]);
        return $config;
    }

    /** @param list<string> $allowedMethods */
    private static function enforceOriginAndMethod(Config $config, array $allowedMethods, int $bufferLevel): void
    {
        $originPolicy = new OriginPolicy($config);
        if ($originPolicy->handlePreflight()) {
            self::discardBufferedOutput($bufferLevel);
            exit;
        }
        $originPolicy->enforceForRequest();

        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if (!in_array($method, $allowedMethods, true)) {
            header('Allow: ' . implode(', ', [...$allowedMethods, 'OPTIONS']));
            throw new ApiException('METHOD_NOT_ALLOWED', 'Méthode HTTP non autorisée pour cette ressource.', 405);
        }
    }

    private static function sendApiException(
        string $requestId,
        Operation $operation,
        ApiException $exception,
        int $bufferLevel,
    ): void {
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
    }

    private static function sendUnexpectedException(
        string $requestId,
        Operation $operation,
        Throwable $exception,
        int $bufferLevel,
    ): void {
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
