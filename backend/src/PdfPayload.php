<?php

declare(strict_types=1);

namespace QcmProxy;

final class PdfPayload
{
    public static function validate(string $bytes, int $maximumBytes): void
    {
        $length = strlen($bytes);
        if ($length === 0) {
            throw new ApiException('EMPTY_PDF', 'Le corps de la requête est vide.', 400);
        }

        if ($length > $maximumBytes) {
            throw new ApiException('PDF_TOO_LARGE', 'Le document PDF dépasse la taille autorisée.', 413);
        }

        if (substr($bytes, 0, 5) !== '%PDF-') {
            throw new ApiException('INVALID_PDF', 'Le corps de la requête n’est pas un document PDF valide.', 415);
        }
    }
}
