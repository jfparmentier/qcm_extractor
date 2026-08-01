<?php

declare(strict_types=1);

use QcmProxy\Application;
use QcmProxy\Operation;

function qcmRunEndpoint(string $operationName): void
{
    qcmRunEntrypoint(static function (string $projectRoot) use ($operationName): void {
        $operation = qcmResolveOperation($operationName);
        Application::run($operation, $projectRoot);
    });
}

function qcmRunBackgroundJobEndpoint(string $operationName, string $action): void
{
    qcmRunEntrypoint(static function (string $projectRoot) use ($operationName, $action): void {
        $operation = qcmResolveOperation($operationName);
        Application::runBackgroundOperation($operation, $action, $projectRoot);
    });
}

function qcmResolveOperation(string $operationName): Operation
{
    return match ($operationName) {
        'mapping' => Operation::Mapping,
        'extraction' => Operation::Extraction,
        default => throw new RuntimeException('Opération inconnue.'),
    };
}

/** @param callable(string):void $runner */
function qcmRunEntrypoint(callable $runner): void
{
    $initialBufferLevel = ob_get_level();
    ob_start();
    @ini_set('display_errors', '0');
    @ini_set('html_errors', '0');

    try {
        $projectRoot = dirname(__DIR__, 2) . '/private';
        require $projectRoot . '/config/bootstrap.php';
        require $projectRoot . '/src/Autoload.php';

        while (ob_get_level() > $initialBufferLevel) {
            @ob_end_clean();
        }
        $runner($projectRoot);
    } catch (Throwable $exception) {
        while (ob_get_level() > $initialBufferLevel) {
            @ob_end_clean();
        }

        $requestId = hash('sha256', uniqid('', true));
        error_log(json_encode([
            'component' => 'qcm-proxy-entrypoint',
            'request_id' => $requestId,
            'exception_class' => $exception::class,
            'message' => substr($exception->getMessage(), 0, 500),
        ], JSON_UNESCAPED_SLASHES) ?: 'qcm-proxy-entrypoint-error');

        $json = json_encode([
            'ok' => false,
            'request_id' => $requestId,
            'error' => [
                'code' => 'PHP_BOOTSTRAP_FAILED',
                'message' => 'Le proxy PHP ne peut pas initialiser sa configuration.',
                'retryable' => false,
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ?: '{"ok":false,"error":{"code":"PHP_BOOTSTRAP_FAILED","message":"Échec d’initialisation PHP.","retryable":false}}';

        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            header('X-QCM-Request-Id: ' . $requestId);
        }
        echo $json;
    }
}


function qcmRunWorkflowConfigEndpoint(): void
{
    $runner = static function (string $projectRoot): void {
        unset($projectRoot);
        $integer = static function (string $name, int $default, int $minimum, int $maximum): int {
            $raw = getenv($name);
            if ($raw === false || filter_var($raw, FILTER_VALIDATE_INT) === false) {
                return $default;
            }
            return max($minimum, min($maximum, (int) $raw));
        };

        $payload = [
            'ok' => true,
            'data' => [
                'batch' => [
                    'maxQuestionsPerBatch' => $integer('QCM_BATCH_MAX_QUESTIONS', 8, 1, 20),
                    'maxPagesPerBatch' => $integer('QCM_BATCH_MAX_PAGES', 14, 1, 40),
                    'maxEstimatedBytes' => $integer('QCM_BATCH_MAX_ESTIMATED_BYTES', 12582912, 1048576, 41943040),
                    'contextPaddingPages' => $integer('QCM_BATCH_CONTEXT_PADDING_PAGES', 1, 0, 3),
                    'maxGapPages' => $integer('QCM_BATCH_MAX_GAP_PAGES', 2, 0, 10),
                ],
                'extraction' => [
                    'maxConcurrentBatches' => $integer('QCM_EXTRACTION_MAX_CONCURRENT_BATCHES', 2, 1, 3),
                    'maxRetries' => $integer('QCM_EXTRACTION_MAX_RETRIES', 1, 0, 2),
                ],
            ],
        ];

        if (!headers_sent()) {
            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            header('X-Content-Type-Options: nosniff');
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    };

    qcmRunEntrypoint($runner);
}
