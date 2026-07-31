<?php

declare(strict_types=1);

namespace QcmProxy;

final readonly class PdfRequest
{
    /** @param array<string, mixed> $context */
    public function __construct(
        public string $filename,
        public string $bytes,
        public array $context,
    ) {
    }
}
