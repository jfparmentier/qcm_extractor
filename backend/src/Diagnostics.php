<?php

declare(strict_types=1);

namespace QcmProxy;

use Throwable;

final class Diagnostics
{
    private static ?string $path = null;

    public static function configure(string $path): void
    {
        self::$path = $path;
    }

    /** @param array<string, scalar|null> $context */
    public static function write(string $event, array $context = []): void
    {
        $path = self::$path;
        if ($path === null || $path === '') {
            return;
        }

        $record = [
            'timestamp' => gmdate('c'),
            'event' => $event,
        ];
        foreach ($context as $key => $value) {
            if (is_string($key) && (is_scalar($value) || $value === null)) {
                $record[$key] = $value;
            }
        }

        try {
            $directory = dirname($path);
            if (!is_dir($directory)) {
                @mkdir($directory, 0700, true);
            }
            $line = json_encode($record, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
            @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
        } catch (Throwable) {
            // Le diagnostic ne doit jamais interrompre la requête principale.
        }
    }
}
