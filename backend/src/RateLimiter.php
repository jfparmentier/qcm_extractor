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

        $now = time();
        $window = $this->config->rateLimitWindowSeconds;
        $bucket = intdiv($now, $window);
        $resetAt = ($bucket + 1) * $window;
        $isLocalDevelopment = $this->isLocalDevelopmentRequest($clientAddress);
        $limit = match ([$operation, $isLocalDevelopment]) {
            [Operation::Extraction, true] => $this->config->rateLimitLocalExtractionRequests,
            [Operation::Extraction, false] => $this->config->rateLimitExtractionRequests,
            [Operation::Mapping, true] => $this->config->rateLimitLocalRequests,
            default => $this->config->rateLimitRequests,
        };
        $scope = $isLocalDevelopment ? 'local' : 'standard';
        $key = hash('sha256', $clientAddress . '|' . $operation->value . '|' . $scope . '|' . $bucket);
        $ttl = max(1, $resetAt - $now + 2);

        $count = match ($this->config->rateLimitBackend) {
            'apcu' => $this->consumeApcu($key, $ttl, $limit),
            'file' => $this->consumeFile($key, $now, $window),
            default => throw new ApiException(
                'RATE_LIMIT_UNAVAILABLE',
                'Le mécanisme de limitation de débit configuré n’est pas disponible.',
                503,
                true,
            ),
        };

        $remaining = max(0, $limit - $count);
        header('X-RateLimit-Limit: ' . $limit);
        header('X-RateLimit-Remaining: ' . $remaining);
        header('X-RateLimit-Reset: ' . $resetAt);
        header('X-RateLimit-Scope: ' . $scope);

        if ($count > $limit) {
            $retryAfter = max(1, $resetAt - $now);
            header('Retry-After: ' . $retryAfter);
            $minutes = max(1, (int) ceil($retryAfter / 60));
            throw new ApiException(
                'RATE_LIMIT_EXCEEDED',
                "Trop de requêtes ont été envoyées. Réessayez dans environ {$minutes} minute(s).",
                429,
                true,
            );
        }
    }

    private function isLocalDevelopmentRequest(string $clientAddress): bool
    {
        $isLoopback = $clientAddress === '::1'
            || preg_match('/^127(?:\.\d{1,3}){3}$/', $clientAddress) === 1;
        if (!$isLoopback) {
            return false;
        }

        $rawHost = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '')));
        if ($rawHost === '') {
            return false;
        }

        if (str_starts_with($rawHost, '[')) {
            $closingBracket = strpos($rawHost, ']');
            $host = $closingBracket === false ? $rawHost : substr($rawHost, 1, $closingBracket - 1);
        } else {
            $host = explode(':', $rawHost, 2)[0];
        }

        return in_array($host, ['localhost', '127.0.0.1', '::1'], true);
    }

    private function consumeApcu(string $key, int $ttl, int $limit): int
    {
        if (
            !function_exists('apcu_add')
            || !function_exists('apcu_inc')
            || !filter_var(ini_get('apc.enabled'), FILTER_VALIDATE_BOOL)
        ) {
            throw new ApiException(
                'RATE_LIMIT_UNAVAILABLE',
                'La limitation de débit APCu n’est pas disponible sur ce serveur.',
                503,
                true,
            );
        }

        $apcuKey = 'qcm_proxy_rl_' . $key;
        if (apcu_add($apcuKey, 1, $ttl)) {
            return 1;
        }

        $success = false;
        $incremented = apcu_inc($apcuKey, 1, $success, $ttl);
        return $success && is_int($incremented)
            ? $incremented
            : $limit + 1;
    }

    private function consumeFile(string $key, int $now, int $window): int
    {
        $directory = rtrim($this->config->rateLimitStorageDir, DIRECTORY_SEPARATOR);
        if ($directory === '') {
            throw new ApiException(
                'RATE_LIMIT_UNAVAILABLE',
                'Le répertoire de limitation de débit est invalide.',
                503,
                true,
            );
        }

        if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new ApiException(
                'RATE_LIMIT_UNAVAILABLE',
                'Le répertoire de limitation de débit ne peut pas être créé.',
                503,
                true,
            );
        }

        $path = $directory . DIRECTORY_SEPARATOR . $key . '.count';
        $stream = @fopen($path, 'c+b');
        if ($stream === false) {
            throw new ApiException(
                'RATE_LIMIT_UNAVAILABLE',
                'Le compteur de limitation de débit ne peut pas être ouvert.',
                503,
                true,
            );
        }

        try {
            if (!flock($stream, LOCK_EX)) {
                throw new ApiException(
                    'RATE_LIMIT_UNAVAILABLE',
                    'Le compteur de limitation de débit ne peut pas être verrouillé.',
                    503,
                    true,
                );
            }

            rewind($stream);
            $raw = stream_get_contents($stream);
            $count = is_string($raw) && preg_match('/^\d+$/', trim($raw)) === 1
                ? (int) trim($raw)
                : 0;
            $count++;

            rewind($stream);
            if (!ftruncate($stream, 0) || fwrite($stream, (string) $count) === false || !fflush($stream)) {
                throw new ApiException(
                    'RATE_LIMIT_UNAVAILABLE',
                    'Le compteur de limitation de débit ne peut pas être mis à jour.',
                    503,
                    true,
                );
            }

            @chmod($path, 0600);
            flock($stream, LOCK_UN);
        } finally {
            fclose($stream);
        }

        $this->cleanupExpiredFiles($directory, $now - (2 * $window));
        return $count;
    }

    private function cleanupExpiredFiles(string $directory, int $threshold): void
    {
        // Nettoyage opportuniste pour éviter une croissance illimitée du dossier.
        try {
            if (random_int(1, 100) !== 1) {
                return;
            }
        } catch (\Throwable) {
            return;
        }

        $paths = glob($directory . DIRECTORY_SEPARATOR . '*.count');
        if (!is_array($paths)) {
            return;
        }

        foreach ($paths as $path) {
            $modifiedAt = @filemtime($path);
            if (is_int($modifiedAt) && $modifiedAt < $threshold) {
                @unlink($path);
            }
        }
    }
}
