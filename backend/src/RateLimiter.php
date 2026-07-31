<?php

declare(strict_types=1);

namespace QcmProxy;

final class RateLimiter
{
    public function __construct(private readonly Config $config)
    {
    }

    public function consume(string $clientAddress, Operation $operation): void
    {
        if ($this->config->rateLimitBackend === 'disabled') {
            return;
        }

        if (!function_exists('apcu_add') || !function_exists('apcu_inc') || !filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOL)) {
            throw new ApiException(
                'RATE_LIMIT_UNAVAILABLE',
                'La limitation de débit en mémoire APCu n’est pas disponible sur ce serveur.',
                503,
                true,
            );
        }

        $now = time();
        $window = $this->config->rateLimitWindowSeconds;
        $bucket = intdiv($now, $window);
        $resetAt = ($bucket + 1) * $window;
        $key = 'qcm_proxy_rl_' . hash('sha256', $clientAddress . '|' . $operation->value . '|' . $bucket);
        $ttl = max(1, $resetAt - $now + 2);

        if (apcu_add($key, 1, $ttl)) {
            $count = 1;
        } else {
            $success = false;
            $incremented = apcu_inc($key, 1, $success, $ttl);
            $count = $success && is_int($incremented) ? $incremented : $this->config->rateLimitRequests + 1;
        }

        $remaining = max(0, $this->config->rateLimitRequests - $count);
        header('X-RateLimit-Limit: ' . $this->config->rateLimitRequests);
        header('X-RateLimit-Remaining: ' . $remaining);
        header('X-RateLimit-Reset: ' . $resetAt);

        if ($count > $this->config->rateLimitRequests) {
            header('Retry-After: ' . max(1, $resetAt - $now));
            throw new ApiException('RATE_LIMIT_EXCEEDED', 'Trop de requêtes ont été envoyées.', 429, true);
        }
    }
}
