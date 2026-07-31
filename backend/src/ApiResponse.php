<?php

declare(strict_types=1);

namespace QcmProxy;

use JsonException;

final class ApiResponse
{
    /** @param array<string, mixed> $payload */
    public static function send(int $status, array $payload): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');

        try {
            echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            http_response_code(500);
            echo '{"ok":false,"error":{"code":"RESPONSE_ENCODING_FAILED","message":"La réponse du proxy ne peut pas être encodée.","retryable":false}}';
        }
    }
}
