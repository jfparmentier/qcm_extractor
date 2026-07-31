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
