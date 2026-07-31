<?php

declare(strict_types=1);

namespace QcmProxy;

final readonly class BackgroundResponseState
{
    /** @param array<string, mixed> $meta */
    public function __construct(
        public string $id,
        public string $status,
        public array $meta,
    ) {
    }
}
