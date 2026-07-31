<?php

declare(strict_types=1);

namespace QcmProxy;

final readonly class UpstreamResponse
{
    /** @param array<string, string> $headers */
    public function __construct(
        public int $status,
        public array $headers,
        public string $body,
    ) {
    }
}
