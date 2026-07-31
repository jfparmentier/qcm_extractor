<?php

declare(strict_types=1);

namespace QcmProxy;

use JsonException;

final class ApiResponse
{
    private static bool $sent = false;

    /** @param array<string, mixed> $payload */
    public static function send(int $status, array $payload): void
    {
        self::$sent = true;

        try {
            $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            $status = 500;
            $json = '{"ok":false,"error":{"code":"RESPONSE_ENCODING_FAILED","message":"La réponse du proxy ne peut pas être encodée.","retryable":false}}';
        }

        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store, max-age=0');
            header('Pragma: no-cache');
        }

        echo $json;
        if (function_exists('fastcgi_finish_request')) {
            @fastcgi_finish_request();
        } else {
            @flush();
        }
    }

    public static function wasSent(): bool
    {
        return self::$sent;
    }
}
