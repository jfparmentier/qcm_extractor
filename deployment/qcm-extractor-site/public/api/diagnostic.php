<?php

declare(strict_types=1);

@ini_set('display_errors', '0');
@ini_set('html_errors', '0');

$projectRoot = dirname(__DIR__, 2) . '/private';
$runtimePath = $projectRoot . '/config/runtime.php';
$runtime = is_file($runtimePath) ? require $runtimePath : [];
$desired = isset($runtime['QCM_PHP_MAX_EXECUTION_SECONDS']) ? (int) $runtime['QCM_PHP_MAX_EXECUTION_SECONDS'] : 150;
@ini_set('max_execution_time', (string) $desired);
if (function_exists('set_time_limit')) {
    @set_time_limit($desired);
}

$rateDir = isset($runtime['QCM_RATE_LIMIT_STORAGE_DIR'])
    ? (string) $runtime['QCM_RATE_LIMIT_STORAGE_DIR']
    : $projectRoot . '/runtime/rate-limit';
$logPath = isset($runtime['QCM_DIAGNOSTIC_LOG_PATH'])
    ? (string) $runtime['QCM_DIAGNOSTIC_LOG_PATH']
    : $projectRoot . '/runtime/logs/qcm-proxy.log';
$logDir = dirname($logPath);
if (!is_dir($logDir)) {
    @mkdir($logDir, 0700, true);
}
if (!is_dir($rateDir)) {
    @mkdir($rateDir, 0700, true);
}

$curl = function_exists('curl_version') ? curl_version() : null;
$payload = [
    'ok' => true,
    'diagnostic' => [
        'php_version' => PHP_VERSION,
        'php_sapi' => PHP_SAPI,
        'max_execution_time' => ini_get('max_execution_time'),
        'desired_max_execution_time' => $desired,
        'memory_limit' => ini_get('memory_limit'),
        'post_max_size' => ini_get('post_max_size'),
        'curl_available' => function_exists('curl_init'),
        'curl_version' => is_array($curl) ? ($curl['version'] ?? null) : null,
        'curl_ssl_version' => is_array($curl) ? ($curl['ssl_version'] ?? null) : null,
        'json_available' => function_exists('json_encode'),
        'openssl_available' => extension_loaded('openssl'),
        'api_key_configured' => isset($runtime['OPENAI_API_KEY']) && trim((string) $runtime['OPENAI_API_KEY']) !== '',
        'mapping_model' => isset($runtime['QCM_OPENAI_MAPPING_MODEL']) ? (string) $runtime['QCM_OPENAI_MAPPING_MODEL'] : 'gpt-5-mini',
        'background_mapping_enabled' => true,
        'background_start_timeout_seconds' => isset($runtime['QCM_BACKGROUND_START_TIMEOUT_SECONDS']) ? (int) $runtime['QCM_BACKGROUND_START_TIMEOUT_SECONDS'] : 25,
        'background_poll_timeout_seconds' => isset($runtime['QCM_BACKGROUND_POLL_TIMEOUT_SECONDS']) ? (int) $runtime['QCM_BACKGROUND_POLL_TIMEOUT_SECONDS'] : 20,
        'background_poll_interval_ms' => isset($runtime['QCM_BACKGROUND_POLL_INTERVAL_MS']) ? (int) $runtime['QCM_BACKGROUND_POLL_INTERVAL_MS'] : 2000,
        'rate_limit_directory_writable' => is_dir($rateDir) && is_writable($rateDir),
        'diagnostic_log_directory_writable' => is_dir($logDir) && is_writable($logDir),
    ],
];

unset($runtime);
$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{"ok":false}';
http_response_code(200);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo $json;
