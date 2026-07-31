<?php

declare(strict_types=1);

namespace QcmProxy;

use JsonException;

final class Base64Url
{
    /** @return array<string, mixed> */
    public static function decodeJsonObject(string $encoded, int $maximumEncodedBytes): array
    {
        if (strlen($encoded) > $maximumEncodedBytes) {
            throw new ApiException('CONTEXT_TOO_LARGE', 'Le contexte de lot est trop volumineux.', 413);
        }

        if (!preg_match('/^[A-Za-z0-9_-]*$/', $encoded)) {
            throw new ApiException('INVALID_CONTEXT', 'Le contexte de lot est invalide.', 400);
        }

        $padding = (4 - (strlen($encoded) % 4)) % 4;
        $decoded = base64_decode(strtr($encoded, '-_', '+/') . str_repeat('=', $padding), true);
        if ($decoded === false) {
            throw new ApiException('INVALID_CONTEXT', 'Le contexte de lot est invalide.', 400);
        }

        try {
            $value = json_decode($decoded, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new ApiException('INVALID_CONTEXT', 'Le contexte de lot ne contient pas un JSON valide.', 400);
        }

        if (!is_array($value) || array_is_list($value)) {
            throw new ApiException('INVALID_CONTEXT', 'Le contexte de lot doit être un objet JSON.', 400);
        }

        return $value;
    }

    /** @param array<string, mixed> $value */
    public static function encodeJsonObject(array $value): string
    {
        try {
            $json = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (JsonException $exception) {
            throw new ApiException('INVALID_CONTEXT', 'Le contexte ne peut pas être encodé.', 400);
        }

        return rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
    }
}
