<?php

declare(strict_types=1);

namespace QcmProxy;

final class OriginPolicy
{
    public function __construct(private readonly Config $config)
    {
    }

    public function handlePreflight(): bool
    {
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'OPTIONS') {
            return false;
        }

        $origin = $this->assertAllowed();
        if ($origin !== null) {
            $this->writeCorsHeaders($origin);
        }

        http_response_code(204);
        header('Content-Length: 0');
        return true;
    }

    public function enforceForRequest(): void
    {
        $origin = $this->assertAllowed();
        if ($origin !== null) {
            $this->writeCorsHeaders($origin);
        }
    }

    public static function normalizeOrigin(string $origin): ?string
    {
        $origin = rtrim(trim($origin), '/');
        $parts = parse_url($origin);
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
            return null;
        }
        if (!in_array(strtolower((string) $parts['scheme']), ['http', 'https'], true)) {
            return null;
        }
        if (isset($parts['path']) && $parts['path'] !== '' && $parts['path'] !== '/') {
            return null;
        }
        if (isset($parts['query']) || isset($parts['fragment']) || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        $scheme = strtolower((string) $parts['scheme']);
        $host = strtolower((string) $parts['host']);
        $port = isset($parts['port']) ? ':' . (int) $parts['port'] : '';
        return "{$scheme}://{$host}{$port}";
    }

    private function assertAllowed(): ?string
    {
        $rawOrigin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
        if ($rawOrigin === '') {
            if ($this->config->allowOriginlessRequests) {
                return null;
            }

            throw new ApiException('ORIGIN_REQUIRED', 'L’origine HTTP de la requête est absente.', 403);
        }

        $origin = self::normalizeOrigin($rawOrigin);
        if ($origin === null) {
            throw new ApiException('ORIGIN_DENIED', 'L’origine HTTP de la requête est invalide.', 403);
        }

        if ($this->isSameOrigin($origin)) {
            return $origin;
        }

        foreach ($this->config->allowedOrigins as $allowed) {
            if (self::normalizeOrigin($allowed) === $origin) {
                return $origin;
            }
        }

        throw new ApiException('ORIGIN_DENIED', 'Cette origine HTTP n’est pas autorisée.', 403);
    }

    private function isSameOrigin(string $origin): bool
    {
        $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
        if ($host === '') {
            return false;
        }

        $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
        $scheme = ($https !== '' && $https !== 'off' && $https !== '0') ? 'https' : 'http';
        return self::normalizeOrigin("{$scheme}://{$host}") === $origin;
    }

    private function writeCorsHeaders(string $origin): void
    {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-QCM-Filename, X-QCM-Context, X-QCM-Job');
        header('Access-Control-Max-Age: 600');
    }
}
