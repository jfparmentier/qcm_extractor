<?php

declare(strict_types=1);

namespace QcmProxy;

final class RequestValidator
{
    public function __construct(private readonly Config $config)
    {
    }

    public function read(Operation $operation): PdfRequest
    {
        $contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
        if ($contentType !== 'application/pdf') {
            throw new ApiException(
                'UNSUPPORTED_MEDIA_TYPE',
                'Le proxy accepte uniquement un corps HTTP brut de type application/pdf.',
                415,
            );
        }

        $declaredLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : null;
        if ($declaredLength !== null && $declaredLength > $this->config->maxPdfBytes) {
            throw new ApiException('PDF_TOO_LARGE', 'Le document PDF dépasse la taille autorisée.', 413);
        }

        $stream = fopen('php://input', 'rb');
        if ($stream === false) {
            throw new ApiException('REQUEST_READ_FAILED', 'Le corps de la requête ne peut pas être lu.', 400);
        }

        $bytes = stream_get_contents($stream, $this->config->maxPdfBytes + 1);
        fclose($stream);
        if ($bytes === false) {
            throw new ApiException('REQUEST_READ_FAILED', 'Le corps de la requête ne peut pas être lu.', 400);
        }

        PdfPayload::validate($bytes, $this->config->maxPdfBytes);

        $contextHeader = trim((string) ($_SERVER['HTTP_X_QCM_CONTEXT'] ?? ''));
        $context = $contextHeader === ''
            ? []
            : Base64Url::decodeJsonObject($contextHeader, $this->config->maxContextHeaderBytes);

        $context = $this->validateContext($operation, $context);

        return new PdfRequest(
            Filename::sanitize($_SERVER['HTTP_X_QCM_FILENAME'] ?? null),
            $bytes,
            $context,
        );
    }

    /**
     * Le contexte est volontairement limité à des métadonnées structurées. Il n’autorise
     * ni prompt, ni modèle, ni instruction libre fournie par le navigateur.
     *
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    public function validateContext(Operation $operation, array $context): array
    {
        if ($operation === Operation::Mapping) {
            if ($context !== []) {
                throw new ApiException('UNEXPECTED_CONTEXT', 'La cartographie globale n’accepte aucun contexte client.', 400);
            }

            return [];
        }

        $allowed = ['batch_id', 'segment_ids', 'original_page_numbers', 'segment_page_map'];
        foreach (array_keys($context) as $key) {
            if (!in_array($key, $allowed, true)) {
                throw new ApiException('INVALID_CONTEXT', 'Le contexte contient une propriété non autorisée.', 400);
            }
        }

        $batchId = $context['batch_id'] ?? 'batch-client';
        if (!is_string($batchId) || !preg_match('/^batch-[A-Za-z0-9._-]{1,80}$/', $batchId)) {
            throw new ApiException('INVALID_CONTEXT', 'L’identifiant du lot est invalide.', 400);
        }

        $segmentIds = $context['segment_ids'] ?? [];
        if (!is_array($segmentIds) || !array_is_list($segmentIds) || count($segmentIds) > 20) {
            throw new ApiException('INVALID_CONTEXT', 'La liste des segments est invalide.', 400);
        }
        foreach ($segmentIds as $segmentId) {
            if (!is_string($segmentId) || !preg_match('/^segment-[A-Za-z0-9._-]{1,80}$/', $segmentId)) {
                throw new ApiException('INVALID_CONTEXT', 'Un identifiant de segment est invalide.', 400);
            }
        }

        $pages = $context['original_page_numbers'] ?? [];
        if (!is_array($pages) || !array_is_list($pages) || count($pages) > 100) {
            throw new ApiException('INVALID_CONTEXT', 'La liste des pages originales est invalide.', 400);
        }
        foreach ($pages as $page) {
            if (!is_int($page) || $page < 1 || $page > 100_000) {
                throw new ApiException('INVALID_CONTEXT', 'Un numéro de page originale est invalide.', 400);
            }
        }

        $pageMap = $context['segment_page_map'] ?? [];
        if (!is_array($pageMap) || array_is_list($pageMap) && $pageMap !== []) {
            throw new ApiException('INVALID_CONTEXT', 'La table des pages de segments est invalide.', 400);
        }
        if (count($pageMap) > 20) {
            throw new ApiException('INVALID_CONTEXT', 'La table des pages de segments est trop volumineuse.', 400);
        }
        foreach ($pageMap as $segmentId => $segmentPages) {
            if (!is_string($segmentId) || !preg_match('/^segment-[A-Za-z0-9._-]{1,80}$/', $segmentId)) {
                throw new ApiException('INVALID_CONTEXT', 'Une clé de segment est invalide.', 400);
            }
            if (!is_array($segmentPages) || !array_is_list($segmentPages) || count($segmentPages) > 20) {
                throw new ApiException('INVALID_CONTEXT', 'Une liste de pages de segment est invalide.', 400);
            }
            foreach ($segmentPages as $page) {
                if (!is_int($page) || $page < 1 || $page > 100_000) {
                    throw new ApiException('INVALID_CONTEXT', 'Un numéro de page de segment est invalide.', 400);
                }
            }
        }

        return [
            'batch_id' => $batchId,
            'segment_ids' => array_values(array_unique($segmentIds)),
            'original_page_numbers' => array_values(array_unique($pages)),
            'segment_page_map' => $pageMap,
        ];
    }
}
