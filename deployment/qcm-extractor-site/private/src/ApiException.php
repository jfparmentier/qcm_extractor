<?php

declare(strict_types=1);

namespace QcmProxy;

use RuntimeException;

final class ApiException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $httpStatus,
        public readonly bool $retryable = false,
    ) {
        parent::__construct($message);
    }
}
