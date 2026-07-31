<?php

declare(strict_types=1);

namespace QcmProxy;

final class Config
{
    /** @param list<string> $allowedOrigins */
    private function __construct(
        public readonly string $projectRoot,
        public readonly string $apiKey,
        public readonly string $mappingModel,
        public readonly string $extractionModel,
        public readonly string $mappingReasoningEffort,
        public readonly string $extractionReasoningEffort,
        public readonly string $textVerbosity,
        public readonly int $maxPdfBytes,
        public readonly int $maxContextHeaderBytes,
        public readonly int $mappingMaxOutputTokens,
        public readonly int $extractionMaxOutputTokens,
        public readonly int $connectTimeoutSeconds,
        public readonly int $requestTimeoutSeconds,
        public readonly int $phpMaxExecutionSeconds,
        public readonly int $maxUpstreamResponseBytes,
        public readonly array $allowedOrigins,
        public readonly bool $allowOriginlessRequests,
        public readonly string $rateLimitBackend,
        public readonly string $rateLimitStorageDir,
        public readonly int $rateLimitRequests,
        public readonly int $rateLimitWindowSeconds,
        public readonly array $trustedProxyAddresses,
        public readonly ?string $openAiProject,
        public readonly ?string $openAiOrganization,
        public readonly string $diagnosticLogPath,
    ) {
    }

    public static function fromEnvironment(string $projectRoot): self
    {
        $apiKey = self::requiredString('OPENAI_API_KEY');
        $requestTimeoutSeconds = self::integer('QCM_REQUEST_TIMEOUT_SECONDS', 120, 10, 600);
        $phpMaxExecutionSeconds = self::integer('QCM_PHP_MAX_EXECUTION_SECONDS', 150, 30, 660);
        if ($phpMaxExecutionSeconds <= $requestTimeoutSeconds) {
            throw new ApiException(
                'SERVER_MISCONFIGURED',
                'QCM_PHP_MAX_EXECUTION_SECONDS doit être supérieur à QCM_REQUEST_TIMEOUT_SECONDS.',
                503,
            );
        }

        return new self(
            projectRoot: rtrim($projectRoot, '/'),
            apiKey: $apiKey,
            mappingModel: self::string('QCM_OPENAI_MAPPING_MODEL', 'gpt-5-mini'),
            extractionModel: self::string('QCM_OPENAI_EXTRACTION_MODEL', 'gpt-5'),
            mappingReasoningEffort: self::enum('QCM_MAPPING_REASONING_EFFORT', 'low', ['minimal', 'low', 'medium', 'high']),
            extractionReasoningEffort: self::enum('QCM_EXTRACTION_REASONING_EFFORT', 'medium', ['minimal', 'low', 'medium', 'high']),
            textVerbosity: self::enum('QCM_TEXT_VERBOSITY', 'low', ['low', 'medium', 'high']),
            maxPdfBytes: self::integer('QCM_MAX_PDF_BYTES', 25 * 1024 * 1024, 1_024, 50 * 1024 * 1024),
            maxContextHeaderBytes: self::integer('QCM_MAX_CONTEXT_HEADER_BYTES', 6_144, 256, 16_384),
            mappingMaxOutputTokens: self::integer('QCM_MAPPING_MAX_OUTPUT_TOKENS', 12_000, 512, 64_000),
            extractionMaxOutputTokens: self::integer('QCM_EXTRACTION_MAX_OUTPUT_TOKENS', 16_000, 512, 64_000),
            connectTimeoutSeconds: self::integer('QCM_CONNECT_TIMEOUT_SECONDS', 10, 1, 60),
            requestTimeoutSeconds: $requestTimeoutSeconds,
            phpMaxExecutionSeconds: $phpMaxExecutionSeconds,
            maxUpstreamResponseBytes: self::integer('QCM_MAX_UPSTREAM_RESPONSE_BYTES', 16 * 1024 * 1024, 1_024, 64 * 1024 * 1024),
            allowedOrigins: self::csv('QCM_ALLOWED_ORIGINS'),
            allowOriginlessRequests: self::boolean('QCM_ALLOW_ORIGINLESS_REQUESTS', false),
            rateLimitBackend: self::enum('QCM_RATE_LIMIT_BACKEND', 'file', ['apcu', 'file', 'disabled']),
            rateLimitStorageDir: self::string('QCM_RATE_LIMIT_STORAGE_DIR', rtrim($projectRoot, '/') . '/runtime/rate-limit'),
            rateLimitRequests: self::integer('QCM_RATE_LIMIT_REQUESTS', 10, 1, 10_000),
            rateLimitWindowSeconds: self::integer('QCM_RATE_LIMIT_WINDOW_SECONDS', 3_600, 60, 86_400),
            trustedProxyAddresses: self::csv('QCM_TRUSTED_PROXY_ADDRESSES'),
            openAiProject: self::nullableString('OPENAI_PROJECT_ID'),
            openAiOrganization: self::nullableString('OPENAI_ORGANIZATION_ID'),
            diagnosticLogPath: self::string('QCM_DIAGNOSTIC_LOG_PATH', rtrim($projectRoot, '/') . '/runtime/logs/qcm-proxy.log'),
        );
    }

    private static function requiredString(string $name): string
    {
        $value = self::nullableString($name);
        if ($value === null) {
            throw new ApiException(
                'SERVER_MISCONFIGURED',
                "La variable d’environnement {$name} est absente.",
                503,
            );
        }

        return $value;
    }

    private static function string(string $name, string $default): string
    {
        return self::nullableString($name) ?? $default;
    }

    private static function nullableString(string $name): ?string
    {
        $value = getenv($name);
        if ($value === false && array_key_exists($name, $_SERVER)) {
            $value = $_SERVER[$name];
        }
        if ($value === false && array_key_exists($name, $_ENV)) {
            $value = $_ENV[$name];
        }
        if (!is_scalar($value)) {
            return null;
        }

        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }

    private static function integer(string $name, int $default, int $minimum, int $maximum): int
    {
        $raw = self::nullableString($name);
        if ($raw === null) {
            return $default;
        }

        if (filter_var($raw, FILTER_VALIDATE_INT) === false) {
            throw new ApiException('SERVER_MISCONFIGURED', "{$name} doit être un entier.", 503);
        }

        $value = (int) $raw;
        if ($value < $minimum || $value > $maximum) {
            throw new ApiException(
                'SERVER_MISCONFIGURED',
                "{$name} doit être compris entre {$minimum} et {$maximum}.",
                503,
            );
        }

        return $value;
    }

    private static function boolean(string $name, bool $default): bool
    {
        $raw = self::nullableString($name);
        if ($raw === null) {
            return $default;
        }

        $value = filter_var($raw, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        if ($value === null) {
            throw new ApiException('SERVER_MISCONFIGURED', "{$name} doit être un booléen.", 503);
        }

        return $value;
    }

    /** @return list<string> */
    private static function csv(string $name): array
    {
        $raw = self::nullableString($name);
        if ($raw === null) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            static fn (string $value): string => rtrim(trim($value), '/'),
            explode(',', $raw),
        ))));
    }

    /** @param list<string> $allowed */
    private static function enum(string $name, string $default, array $allowed): string
    {
        $value = self::string($name, $default);
        if (!in_array($value, $allowed, true)) {
            throw new ApiException('SERVER_MISCONFIGURED', "Valeur invalide pour {$name}.", 503);
        }

        return $value;
    }
}
