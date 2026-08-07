<?php

declare(strict_types=1);

@ini_set('display_errors', '0');
@ini_set('html_errors', '0');

try {
    $projectRoot = dirname(__DIR__, 2) . '/private';
    require $projectRoot . '/config/bootstrap.php';
    require $projectRoot . '/src/Autoload.php';
    QcmProxy\EmailAccessEndpoint::run($projectRoot);
} catch (Throwable $exception) {
    $requestId = hash('sha256', uniqid('', true));
    error_log(json_encode([
        'component' => 'qcm-auth-entrypoint',
        'request_id' => $requestId,
        'exception_class' => $exception::class,
    ], JSON_UNESCAPED_SLASHES) ?: 'qcm-auth-entrypoint-error');
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-QCM-Request-Id: ' . $requestId);
    }
    echo '{"ok":false,"error":{"code":"PHP_BOOTSTRAP_FAILED","message":"Le service de connexion ne peut pas démarrer.","retryable":true}}';
}
