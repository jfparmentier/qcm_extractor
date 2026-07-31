<?php

declare(strict_types=1);

namespace QcmProxy;

use JsonException;

final class BackgroundJobToken
{
    /** @return array{token:string,expires_at:int} */
    public static function issue(string $responseId, Operation $operation, Config $config): array
    {
        self::assertResponseId($responseId);
        $expiresAt = time() + $config->backgroundJobTtlSeconds;
        $payload = [
            'v' => 1,
            'response_id' => $responseId,
            'operation' => $operation->value,
            'expires_at' => $expiresAt,
        ];

        try {
            $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            throw new ApiException('JOB_TOKEN_FAILED', 'Le jeton de suivi ne peut pas être créé.', 500, false);
        }

        $encodedPayload = self::encode($json);
        $signature = hash_hmac('sha256', $encodedPayload, self::key($config), true);

        return [
            'token' => $encodedPayload . '.' . self::encode($signature),
            'expires_at' => $expiresAt,
        ];
    }

    /** @return array{response_id:string,operation:Operation,expires_at:int} */
    public static function verify(string $token, Config $config): array
    {
        if (strlen($token) < 40 || strlen($token) > 2048 || substr_count($token, '.') !== 1) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton de suivi est invalide.', 400, false);
        }

        [$encodedPayload, $encodedSignature] = explode('.', $token, 2);
        $providedSignature = self::decode($encodedSignature);
        $expectedSignature = hash_hmac('sha256', $encodedPayload, self::key($config), true);
        if (!hash_equals($expectedSignature, $providedSignature)) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton de suivi est invalide.', 400, false);
        }

        $json = self::decode($encodedPayload);
        try {
            $payload = json_decode($json, true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton de suivi est invalide.', 400, false);
        }
        if (!is_array($payload) || array_is_list($payload) || ($payload['v'] ?? null) !== 1) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton de suivi est invalide.', 400, false);
        }

        $responseId = $payload['response_id'] ?? null;
        $operationValue = $payload['operation'] ?? null;
        $expiresAt = $payload['expires_at'] ?? null;
        if (!is_string($responseId) || !is_string($operationValue) || !is_int($expiresAt)) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton de suivi est invalide.', 400, false);
        }
        self::assertResponseId($responseId);
        if ($expiresAt < time()) {
            throw new ApiException('JOB_TOKEN_EXPIRED', 'Le délai de suivi de cette analyse est expiré.', 410, true);
        }

        $operation = Operation::tryFrom($operationValue);
        if ($operation === null) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton de suivi est invalide.', 400, false);
        }

        return [
            'response_id' => $responseId,
            'operation' => $operation,
            'expires_at' => $expiresAt,
        ];
    }

    private static function assertResponseId(string $responseId): void
    {
        if (!preg_match('/^resp_[A-Za-z0-9_-]{8,240}$/', $responseId)) {
            throw new ApiException('INVALID_JOB_TOKEN', 'L’identifiant de réponse du fournisseur est invalide.', 400, false);
        }
    }

    private static function key(Config $config): string
    {
        return hash('sha256', "qcm-background-job\0" . $config->apiKey, true);
    }

    private static function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function decode(string $value): string
    {
        if ($value === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $value)) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton de suivi est invalide.', 400, false);
        }
        $padding = (4 - (strlen($value) % 4)) % 4;
        $decoded = base64_decode(strtr($value, '-_', '+/') . str_repeat('=', $padding), true);
        if ($decoded === false) {
            throw new ApiException('INVALID_JOB_TOKEN', 'Le jeton de suivi est invalide.', 400, false);
        }

        return $decoded;
    }
}
