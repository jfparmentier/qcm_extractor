<?php

declare(strict_types=1);

namespace QcmProxy;

use JsonException;

final class OpenAiResponseParser
{
    public function parse(UpstreamResponse $response): ParsedLlmResult
    {
        if ($response->status < 200 || $response->status >= 300) {
            $this->throwForStatus($response->status);
        }

        try {
            $decoded = json_decode($response->body, true, 256, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new ApiException('INVALID_UPSTREAM_RESPONSE', 'Le fournisseur a renvoyé une réponse illisible.', 502, true);
        }
        if (!is_array($decoded) || array_is_list($decoded)) {
            throw new ApiException('INVALID_UPSTREAM_RESPONSE', 'Le fournisseur a renvoyé une réponse inattendue.', 502, true);
        }

        $status = $decoded['status'] ?? null;
        if ($status !== 'completed') {
            $retryable = in_array($status, ['failed', 'cancelled', 'incomplete'], true);
            throw new ApiException('LLM_RESPONSE_INCOMPLETE', 'L’analyse du document n’a pas été menée à son terme.', 502, $retryable);
        }

        $texts = [];
        foreach (($decoded['output'] ?? []) as $item) {
            if (!is_array($item) || ($item['type'] ?? null) !== 'message') {
                continue;
            }
            foreach (($item['content'] ?? []) as $content) {
                if (!is_array($content)) {
                    continue;
                }
                if (($content['type'] ?? null) === 'refusal') {
                    throw new ApiException('LLM_REFUSAL', 'Le fournisseur a refusé d’analyser ce document.', 422, false);
                }
                if (($content['type'] ?? null) === 'output_text' && is_string($content['text'] ?? null)) {
                    $texts[] = $content['text'];
                }
            }
        }

        $text = trim(implode('', $texts));
        if ($text === '') {
            throw new ApiException('EMPTY_UPSTREAM_RESPONSE', 'Le fournisseur n’a renvoyé aucun résultat exploitable.', 502, true);
        }

        try {
            $data = json_decode($text, true, 256, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new ApiException('INVALID_STRUCTURED_OUTPUT', 'Le résultat structuré du fournisseur est invalide.', 502, true);
        }
        if (!is_array($data) || array_is_list($data)) {
            throw new ApiException('INVALID_STRUCTURED_OUTPUT', 'Le résultat structuré doit être un objet JSON.', 502, true);
        }

        $usage = is_array($decoded['usage'] ?? null) ? $decoded['usage'] : [];
        return new ParsedLlmResult($data, [
            'provider_response_id' => is_string($decoded['id'] ?? null) ? $decoded['id'] : null,
            'provider_request_id' => $response->headers['x-request-id'] ?? null,
            'model' => is_string($decoded['model'] ?? null) ? $decoded['model'] : null,
            'usage' => [
                'input_tokens' => is_int($usage['input_tokens'] ?? null) ? $usage['input_tokens'] : null,
                'output_tokens' => is_int($usage['output_tokens'] ?? null) ? $usage['output_tokens'] : null,
                'total_tokens' => is_int($usage['total_tokens'] ?? null) ? $usage['total_tokens'] : null,
            ],
        ]);
    }

    private function throwForStatus(int $status): never
    {
        if ($status === 401 || $status === 403) {
            throw new ApiException('UPSTREAM_AUTHENTICATION_FAILED', 'Le proxy ne peut pas s’authentifier auprès du fournisseur LLM.', 502, false);
        }
        if ($status === 413) {
            throw new ApiException('UPSTREAM_PAYLOAD_TOO_LARGE', 'Le document est trop volumineux pour le fournisseur LLM.', 413, false);
        }
        if ($status === 429) {
            throw new ApiException('UPSTREAM_RATE_LIMITED', 'Le fournisseur LLM limite temporairement les requêtes.', 503, true);
        }
        if ($status >= 500) {
            throw new ApiException('UPSTREAM_UNAVAILABLE', 'Le fournisseur LLM est temporairement indisponible.', 503, true);
        }

        throw new ApiException('UPSTREAM_REJECTED_REQUEST', 'Le fournisseur LLM a rejeté la requête.', 502, false);
    }
}
