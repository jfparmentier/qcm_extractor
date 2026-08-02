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

        return new PdfRequest(
            Filename::sanitize($_SERVER['HTTP_X_QCM_FILENAME'] ?? null),
            $bytes,
            $this->validateContext($operation, $context),
        );
    }

    /**
     * Le contexte est limité à des métadonnées structurées. Il n’autorise ni prompt,
     * ni modèle, ni instruction libre fournie par le navigateur.
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

        $allowed = [
            'batch_id',
            'segment_ids',
            'original_page_numbers',
            'local_to_original_page_map',
            'segment_page_map',
            'segments',
        ];
        foreach (array_keys($context) as $key) {
            if (!in_array($key, $allowed, true)) {
                throw new ApiException('INVALID_CONTEXT', 'Le contexte contient une propriété non autorisée.', 400);
            }
        }

        $batchId = $context['batch_id'] ?? null;
        if (!is_string($batchId) || !preg_match('/^batch-[A-Za-z0-9._-]{1,80}$/', $batchId)) {
            throw new ApiException('INVALID_CONTEXT', 'L’identifiant du lot est invalide.', 400);
        }

        $segmentIds = $this->validateSegmentIds($context['segment_ids'] ?? null);
        if ($segmentIds === []) {
            throw new ApiException('INVALID_CONTEXT', 'Le lot doit contenir au moins un segment.', 400);
        }

        $originalPages = $this->validatePages($context['original_page_numbers'] ?? null, 100, 'pages originales');
        $localPageMap = $this->validatePages($context['local_to_original_page_map'] ?? null, 100, 'correspondance locale');
        if ($originalPages !== $localPageMap) {
            throw new ApiException(
                'INVALID_CONTEXT',
                'La correspondance entre pages locales et originales est incohérente.',
                400,
            );
        }

        $segmentPageMap = $this->validateSegmentPageMap($context['segment_page_map'] ?? null, $segmentIds);
        $segments = $this->validateSegments($context['segments'] ?? null, $segmentIds, $originalPages, $localPageMap);

        return [
            'batch_id' => $batchId,
            'segment_ids' => $segmentIds,
            'original_page_numbers' => $originalPages,
            'local_to_original_page_map' => $localPageMap,
            'segment_page_map' => $segmentPageMap,
            'segments' => $segments,
        ];
    }

    /** @return list<string> */
    private function validateSegmentIds(mixed $value): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) > 20) {
            throw new ApiException('INVALID_CONTEXT', 'La liste des segments est invalide.', 400);
        }

        $result = [];
        foreach ($value as $segmentId) {
            if (!is_string($segmentId) || !preg_match('/^segment-[A-Za-z0-9._-]{1,80}$/', $segmentId)) {
                throw new ApiException('INVALID_CONTEXT', 'Un identifiant de segment est invalide.', 400);
            }
            $result[] = $segmentId;
        }

        return array_values(array_unique($result));
    }

    /** @return list<int> */
    private function validatePages(mixed $value, int $maximumCount, string $label): array
    {
        if (!is_array($value) || !array_is_list($value) || count($value) > $maximumCount) {
            throw new ApiException('INVALID_CONTEXT', "La liste des {$label} est invalide.", 400);
        }

        $result = [];
        foreach ($value as $page) {
            if (!is_int($page) || $page < 1 || $page > 100_000) {
                throw new ApiException('INVALID_CONTEXT', "Un numéro de {$label} est invalide.", 400);
            }
            $result[] = $page;
        }

        return array_values(array_unique($result));
    }

    /**
     * @param list<string> $segmentIds
     * @return array<string, list<int>>
     */
    private function validateSegmentPageMap(mixed $value, array $segmentIds): array
    {
        if (!is_array($value) || (array_is_list($value) && $value !== []) || count($value) > 20) {
            throw new ApiException('INVALID_CONTEXT', 'La table des pages de segments est invalide.', 400);
        }

        $result = [];
        foreach ($value as $segmentId => $pages) {
            if (!is_string($segmentId) || !in_array($segmentId, $segmentIds, true)) {
                throw new ApiException('INVALID_CONTEXT', 'Une clé de segment est invalide.', 400);
            }
            $result[$segmentId] = $this->validatePages($pages, 40, 'pages de segment');
        }

        return $result;
    }

    /**
     * @param list<string> $segmentIds
     * @param list<int> $originalPages
     * @param list<int> $localPageMap
     * @return list<array<string, mixed>>
     */
    private function validateSegments(
        mixed $value,
        array $segmentIds,
        array $originalPages,
        array $localPageMap,
    ): array {
        if (!is_array($value) || !array_is_list($value) || count($value) > 20) {
            throw new ApiException('INVALID_CONTEXT', 'La description des segments est invalide.', 400);
        }

        $allowedHints = ['single_choice', 'multiple_choice', 'true_false', 'unknown'];
        $allowedRoles = ['question', 'essential_image'];
        $result = [];
        $seen = [];

        foreach ($value as $segment) {
            if (!is_array($segment) || array_is_list($segment)) {
                throw new ApiException('INVALID_CONTEXT', 'Une description de segment est invalide.', 400);
            }
            $allowedKeys = [
                'id', 'question_number', 'question_type_hint', 'source_pages', 'local_pages',
                'contains_essential_image', 'regions',
            ];
            foreach (array_keys($segment) as $key) {
                if (!in_array($key, $allowedKeys, true)) {
                    throw new ApiException('INVALID_CONTEXT', 'Une description de segment contient une propriété inconnue.', 400);
                }
            }

            $id = $segment['id'] ?? null;
            if (!is_string($id) || !in_array($id, $segmentIds, true) || isset($seen[$id])) {
                throw new ApiException('INVALID_CONTEXT', 'Un segment décrit est inconnu ou dupliqué.', 400);
            }
            $seen[$id] = true;

            $questionNumber = $segment['question_number'] ?? null;
            if ($questionNumber !== null && (!is_string($questionNumber) || strlen($questionNumber) > 80)) {
                throw new ApiException('INVALID_CONTEXT', 'Le numéro de question est invalide.', 400);
            }
            $hint = $segment['question_type_hint'] ?? null;
            if (!is_string($hint) || !in_array($hint, $allowedHints, true)) {
                throw new ApiException('INVALID_CONTEXT', 'Le type indicatif d’une question est invalide.', 400);
            }
            $sourcePages = $this->validatePages($segment['source_pages'] ?? null, 40, 'pages source');
            foreach ($sourcePages as $page) {
                if (!in_array($page, $originalPages, true)) {
                    throw new ApiException('INVALID_CONTEXT', 'Une page source est étrangère au lot.', 400);
                }
            }
            $localPages = $this->validatePages($segment['local_pages'] ?? null, 40, 'pages locales');
            foreach ($localPages as $page) {
                if ($page > count($localPageMap)) {
                    throw new ApiException('INVALID_CONTEXT', 'Une page locale est étrangère au sous-PDF.', 400);
                }
            }
            $containsImage = $segment['contains_essential_image'] ?? null;
            if (!is_bool($containsImage)) {
                throw new ApiException('INVALID_CONTEXT', 'L’indicateur d’image essentielle est invalide.', 400);
            }

            $regions = $segment['regions'] ?? null;
            if (!is_array($regions) || !array_is_list($regions) || count($regions) > 40) {
                throw new ApiException('INVALID_CONTEXT', 'La liste des régions d’un segment est invalide.', 400);
            }
            $validatedRegions = [];
            foreach ($regions as $region) {
                if (!is_array($region) || array_is_list($region)) {
                    throw new ApiException('INVALID_CONTEXT', 'Une région de segment est invalide.', 400);
                }
                $sourcePage = $region['source_page'] ?? null;
                $localPage = $region['local_page'] ?? null;
                $role = $region['role'] ?? null;
                $bbox = $region['bbox'] ?? null;
                if (!is_int($sourcePage) || !in_array($sourcePage, $originalPages, true)) {
                    throw new ApiException('INVALID_CONTEXT', 'La page source d’une région est invalide.', 400);
                }
                if (!is_int($localPage) || $localPage < 1 || $localPage > count($localPageMap)) {
                    throw new ApiException('INVALID_CONTEXT', 'La page locale d’une région est invalide.', 400);
                }
                if (($localPageMap[$localPage - 1] ?? null) !== $sourcePage) {
                    throw new ApiException('INVALID_CONTEXT', 'La correspondance de page d’une région est incohérente.', 400);
                }
                if (!is_string($role) || !in_array($role, $allowedRoles, true)) {
                    throw new ApiException('INVALID_CONTEXT', 'Le rôle d’une région est invalide.', 400);
                }
                if (!is_array($bbox) || !array_is_list($bbox) || count($bbox) !== 4) {
                    throw new ApiException('INVALID_CONTEXT', 'La boîte englobante d’une région est invalide.', 400);
                }
                $numbers = [];
                foreach ($bbox as $coordinate) {
                    if (!is_int($coordinate) && !is_float($coordinate)) {
                        throw new ApiException('INVALID_CONTEXT', 'Une coordonnée de région est invalide.', 400);
                    }
                    $number = (float) $coordinate;
                    if (!is_finite($number) || $number < 0 || $number > 1) {
                        throw new ApiException('INVALID_CONTEXT', 'Une coordonnée de région est hors limites.', 400);
                    }
                    $numbers[] = $number;
                }
                if ($numbers[2] <= 0 || $numbers[3] <= 0 || $numbers[0] + $numbers[2] > 1.00001 || $numbers[1] + $numbers[3] > 1.00001) {
                    throw new ApiException('INVALID_CONTEXT', 'Une boîte englobante de région dépasse la page.', 400);
                }
                $validatedRegions[] = [
                    'source_page' => $sourcePage,
                    'local_page' => $localPage,
                    'role' => $role,
                    'bbox' => $numbers,
                ];
            }

            $result[] = [
                'id' => $id,
                'question_number' => $questionNumber,
                'question_type_hint' => $hint,
                'source_pages' => $sourcePages,
                'local_pages' => $localPages,
                'contains_essential_image' => $containsImage,
                'regions' => $validatedRegions,
            ];
        }

        if (count($seen) !== count($segmentIds)) {
            throw new ApiException('INVALID_CONTEXT', 'Tous les segments du lot doivent être décrits.', 400);
        }

        return $result;
    }
}
