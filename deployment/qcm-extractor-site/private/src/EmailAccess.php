<?php

declare(strict_types=1);

namespace QcmProxy;

final class EmailAccess
{
    private const SESSION_NAME = 'qcm_access';
    private const SESSION_EMAIL_KEY = 'authenticated_email';

    /** @return list<string> */
    public static function allowedDomains(string $backendRoot): array
    {
        $path = rtrim($backendRoot, '/') . '/config/allowed-email-domains.php';
        if (!is_file($path)) {
            throw new ApiException(
                'EMAIL_DOMAIN_CONFIG_MISSING',
                'La liste des domaines autorisés est indisponible.',
                503,
                true,
            );
        }

        $configured = require $path;
        if (!is_array($configured)) {
            throw new ApiException(
                'EMAIL_DOMAIN_CONFIG_INVALID',
                'La liste des domaines autorisés est invalide.',
                503,
                false,
            );
        }

        $domains = [];
        foreach ($configured as $domain) {
            if (!is_string($domain)) {
                continue;
            }
            $normalized = strtolower(ltrim(trim($domain), '@'));
            if ($normalized !== '' && preg_match('/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/', $normalized) === 1) {
                $domains[] = $normalized;
            }
        }

        $domains = array_values(array_unique($domains));
        if ($domains === []) {
            throw new ApiException(
                'EMAIL_DOMAIN_CONFIG_EMPTY',
                'Aucun domaine de messagerie n’est autorisé.',
                503,
                false,
            );
        }
        return $domains;
    }

    /** @param list<string> $allowedDomains */
    public static function normalizeAuthorizedEmail(string $email, array $allowedDomains): ?string
    {
        $email = trim($email);
        if ($email === '' || strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return null;
        }

        $separator = strrpos($email, '@');
        if ($separator === false) {
            return null;
        }
        $localPart = substr($email, 0, $separator);
        $domain = strtolower(substr($email, $separator + 1));
        if ($localPart === '' || !in_array($domain, $allowedDomains, true)) {
            return null;
        }
        return $localPart . '@' . $domain;
    }

    public static function authenticate(string $backendRoot, string $email): string
    {
        $normalized = self::normalizeAuthorizedEmail($email, self::allowedDomains($backendRoot));
        if ($normalized === null) {
            throw new ApiException(
                'EMAIL_NOT_ALLOWED',
                'Cette adresse email n’est pas autorisée à accéder à l’application.',
                403,
                false,
            );
        }

        self::startSession();
        if (!session_regenerate_id(true)) {
            session_write_close();
            throw new ApiException(
                'SESSION_UNAVAILABLE',
                'La session de connexion ne peut pas être sécurisée.',
                503,
                true,
            );
        }
        $_SESSION[self::SESSION_EMAIL_KEY] = $normalized;
        session_write_close();
        return $normalized;
    }

    public static function currentEmail(string $backendRoot): ?string
    {
        self::startSession();
        $stored = $_SESSION[self::SESSION_EMAIL_KEY] ?? null;
        $normalized = is_string($stored)
            ? self::normalizeAuthorizedEmail($stored, self::allowedDomains($backendRoot))
            : null;
        if ($normalized === null) {
            unset($_SESSION[self::SESSION_EMAIL_KEY]);
        }
        session_write_close();
        return $normalized;
    }

    public static function requireAuthenticated(string $backendRoot): string
    {
        $email = self::currentEmail($backendRoot);
        if ($email === null) {
            throw new ApiException(
                'AUTHENTICATION_REQUIRED',
                'Une connexion avec une adresse email autorisée est requise.',
                401,
                false,
            );
        }
        return $email;
    }

    private static function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $secure = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
        $scriptDirectory = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')));
        $cookiePath = $scriptDirectory === '.' || $scriptDirectory === '' ? '/' : rtrim($scriptDirectory, '/') . '/';
        session_name(self::SESSION_NAME);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => $cookiePath,
            'secure' => $secure !== '' && $secure !== 'off' && $secure !== '0',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        if (!session_start([
            'use_cookies' => true,
            'use_only_cookies' => true,
            'use_strict_mode' => true,
        ])) {
            throw new ApiException(
                'SESSION_UNAVAILABLE',
                'La session de connexion ne peut pas être initialisée.',
                503,
                true,
            );
        }
    }
}
