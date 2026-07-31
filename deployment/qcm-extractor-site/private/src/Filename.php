<?php

declare(strict_types=1);

namespace QcmProxy;

final class Filename
{
    public static function sanitize(?string $raw): string
    {
        if ($raw === null || trim($raw) === '') {
            return 'document.pdf';
        }

        $decoded = rawurldecode($raw);
        $decoded = str_replace('\\', '/', $decoded);
        $decoded = basename($decoded);
        $decoded = preg_replace('/[\x00-\x1F\x7F]/u', '', $decoded) ?? '';
        $decoded = trim($decoded);

        if ($decoded === '') {
            return 'document.pdf';
        }

        if (function_exists('mb_substr')) {
            $decoded = mb_substr($decoded, 0, 120, 'UTF-8');
        } else {
            $decoded = substr($decoded, 0, 120);
        }

        if (!str_ends_with(strtolower($decoded), '.pdf')) {
            $decoded .= '.pdf';
        }

        return $decoded;
    }
}
