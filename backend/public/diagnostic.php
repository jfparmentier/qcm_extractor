<?php

declare(strict_types=1);

@ini_set('display_errors', '0');
@ini_set('html_errors', '0');

$projectRoot = dirname(__DIR__);
$configPath = $projectRoot . '/config/environment.example';
$runtimeAvailable = is_file($projectRoot . '/config/bootstrap.php');

$desired = 150;
@ini_set('max_execution_time', (string) $desired);
if (function_exists('set_time_limit')) {
    @set_time_limit($desired);
}

$curl = function_exists('curl_version') ? curl_version() : null;
$payload = [
    'ok' => true,
    'diagnostic' => [
        'php_version' => PHP_VERSION,
        'php_sapi' => PHP_SAPI,
        'max_execution_time' => ini_get('max_execution_time'),
        'memory_limit' => ini_get('memory_limit'),
        'post_max_size' => ini_get('post_max_size'),
        'curl_available' => function_exists('curl_init'),
        'curl_version' => is_array($curl) ? ($curl['version'] ?? null) : null,
        'curl_ssl_version' => is_array($curl) ? ($curl['ssl_version'] ?? null) : null,
        'json_available' => function_exists('json_encode'),
        'openssl_available' => extension_loaded('openssl'),
        'bootstrap_available' => $runtimeAvailable,
        'environment_example_available' => is_file($configPath),
        'background_mapping_enabled' => true,
        'background_extraction_enabled' => true,
    ],
];

$json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{"ok":false}';
http_response_code(200);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo $json;
