<?php

declare(strict_types=1);

namespace QcmProxy;

final class ClientAddress
{
    public static function resolve(Config $config): string
    {
        $remote = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
        if (!self::isIp($remote)) {
            return 'unknown';
        }

        if (!in_array($remote, $config->trustedProxyAddresses, true)) {
            return $remote;
        }

        $forwarded = trim((string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
        if ($forwarded === '') {
            return $remote;
        }

        foreach (explode(',', $forwarded) as $candidate) {
            $candidate = trim($candidate);
            if (self::isIp($candidate)) {
                return $candidate;
            }
        }

        return $remote;
    }

    private static function isIp(string $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_IP) !== false;
    }
}
