<?php

declare(strict_types=1);

namespace QcmProxy;

use JsonException;
use Throwable;

final class EmailAccessEndpoint
{
    public static function run(string $backendRoot): void
    {
        $requestId = self::requestId();
        @ini_set('display_errors', '0');
        @ini_set('html_errors', '0');
        SecurityHeaders::apply();
        header('X-QCM-Request-Id: ' . $requestId);

        try {
            $config = Config::fromEnvironment($backendRoot);
            $originPolicy = new OriginPolicy($config);
            if ($originPolicy->handlePreflight()) {
                return;
            }
            if (trim((string) ($_SERVER['HTTP_ORIGIN'] ?? '')) !== '') {
                $originPolicy->enforceForRequest();
            }

            $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
            if ($method === 'GET') {
                $email = EmailAccess::currentEmail($backendRoot);
                ApiResponse::send(200, [
                    'ok' => true,
                    'authenticated' => $email !== null,
                    'email' => $email,
                ]);
                return;
            }

            if ($method !== 'POST') {
                throw new ApiException('METHOD_NOT_ALLOWED', 'Méthode HTTP non autorisée.', 405, false);
            }

            $email = self::readEmail();
            ApiResponse::send(200, [
                'ok' => true,
                'authenticated' => true,
                'email' => EmailAccess::authenticate($backendRoot, $email),
            ]);
        } catch (ApiException $exception) {
            ApiResponse::send($exception->httpStatus, [
                'ok' => false,
                'request_id' => $requestId,
                'error' => [
                    'code' => $exception->errorCode,
                    'message' => $exception->getMessage(),
                    'retryable' => $exception->retryable,
                ],
            ]);
        } catch (Throwable $exception) {
            error_log(json_encode([
                'component' => 'qcm-email-access',
                'request_id' => $requestId,
                'exception_class' => $exception::class,
            ], JSON_UNESCAPED_SLASHES) ?: 'qcm-email-access-error');
            ApiResponse::send(500, [
                'ok' => false,
                'request_id' => $requestId,
                'error' => [
                    'code' => 'AUTHENTICATION_FAILED',
                    'message' => 'La vérification de l’adresse email a échoué.',
                    'retryable' => true,
                ],
            ]);
        }
    }

    private static function readEmail(): string
    {
        $raw = file_get_contents('php://input', false, null, 0, 4097);
        if (!is_string($raw) || strlen($raw) > 4096) {
            throw new ApiException('INVALID_AUTH_PAYLOAD', 'La requête de connexion est invalide.', 400, false);
        }

        try {
            $payload = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new ApiException('INVALID_AUTH_PAYLOAD', 'La requête de connexion est invalide.', 400, false);
        }
        if (!is_array($payload) || !is_string($payload['email'] ?? null)) {
            throw new ApiException('INVALID_AUTH_PAYLOAD', 'Une adresse email est requise.', 400, false);
        }
        return $payload['email'];
    }

    private static function requestId(): string
    {
        try {
            return bin2hex(random_bytes(16));
        } catch (Throwable) {
            return hash('sha256', uniqid('', true));
        }
    }
}
