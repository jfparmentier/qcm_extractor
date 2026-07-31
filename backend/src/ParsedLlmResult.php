<?php

declare(strict_types=1);

namespace QcmProxy;

final readonly class ParsedLlmResult
{
    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $meta
     */
    public function __construct(public array $data, public array $meta)
    {
    }
}
