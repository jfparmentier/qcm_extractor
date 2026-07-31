<?php

declare(strict_types=1);

use QcmProxy\Application;
use QcmProxy\Operation;

function qcmRunEndpoint(string $operationName): void
{
    $initialBufferLevel = ob_get_level();
    ob_start();
    @ini_set('display_errors', '0');
    @ini_set('html_errors', '0');

    try {
        $projectRoot = dirname(__DIR__);
        require $projectRoot . '/src/Autoload.php';

        $operation = match ($operationName) {
            'mapping' => Operation::Mapping,
            'extraction' => Operation::Extraction,
            default => throw new RuntimeException('Opération inconnue.'),
        };

        while (ob_get_level() > $initialBufferLevel) {
            @ob_end_clean();
        }
        Application::run($operation, $projectRoot);
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
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{"ok":false,"error":{"code":"PHP_BOOTSTRAP_FAILED","message":"Échec d’initialisation PHP.","retryable":false}}';

        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            header('X-QCM-Request-Id: ' . $requestId);
        }
        echo $json;
    }
}

function qcmRunBackgroundJobEndpoint(string $operationName, string $action): void
{
    $initialBufferLevel = ob_get_level();
    ob_start();
    @ini_set('display_errors', '0');
    @ini_set('html_errors', '0');

    try {
        $projectRoot = dirname(__DIR__);
        require $projectRoot . '/src/Autoload.php';

        $operation = match ($operationName) {
            'mapping' => Operation::Mapping,
            'extraction' => Operation::Extraction,
            default => throw new RuntimeException('Opération inconnue.'),
        };

        while (ob_get_level() > $initialBufferLevel) {
            @ob_end_clean();
        }
        Application::runBackgroundOperation($operation, $action, $projectRoot);
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
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{"ok":false,"error":{"code":"PHP_BOOTSTRAP_FAILED","message":"Échec d’initialisation PHP.","retryable":false}}';

        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            header('X-QCM-Request-Id: ' . $requestId);
        }
        echo $json;
    }
}
