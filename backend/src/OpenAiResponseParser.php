<?php

declare(strict_types=1);

namespace QcmProxy;

use JsonException;

final class OpenAiResponseParser
{
    public function inspect(UpstreamResponse $response): BackgroundResponseState
    {
        $decoded = $this->decode($response);
        $id = $decoded['id'] ?? null;
        $status = $decoded['status'] ?? null;
        if (!is_string($id) || !preg_match('/^resp_[A-Za-z0-9_-]{8,240}$/', $id) || !is_string($status)) {
            throw new ApiException('INVALID_UPSTREAM_RESPONSE', 'Le fournisseur a renvoyé une réponse inattendue.', 502, true);
        }

        return new BackgroundResponseState($id, $status, $this->meta($decoded, $response));
    }

    public function parse(UpstreamResponse $response): ParsedLlmResult
    {
        $decoded = $this->decode($response);
        $status = $decoded['status'] ?? null;
        if ($status !== 'completed') {
            $this->throwForTerminalStatus($decoded);
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

        return new ParsedLlmResult($data, $this->meta($decoded, $response));
    }

    /** @return array<string, mixed> */
    private function decode(UpstreamResponse $response): array
    {
        if ($response->status < 200 || $response->status >= 300) {
            $this->throwForResponse($response);
        }

        try {
            $decoded = json_decode($response->body, true, 256, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new ApiException('INVALID_UPSTREAM_RESPONSE', 'Le fournisseur a renvoyé une réponse illisible.', 502, true);
        }
        if (!is_array($decoded) || array_is_list($decoded)) {
            throw new ApiException('INVALID_UPSTREAM_RESPONSE', 'Le fournisseur a renvoyé une réponse inattendue.', 502, true);
        }

        return $decoded;
    }

    /** @param array<string, mixed> $decoded */
    private function throwForTerminalStatus(array $decoded): never
    {
        $status = $decoded['status'] ?? null;
        $reason = is_array($decoded['incomplete_details'] ?? null)
            ? ($decoded['incomplete_details']['reason'] ?? null)
            : null;
        $providerError = is_array($decoded['error'] ?? null) ? $decoded['error'] : [];
        $providerMessage = is_scalar($providerError['message'] ?? null)
            ? (string) $providerError['message']
            : null;

        Diagnostics::write('upstream_incomplete', [
            'response_status' => is_scalar($status) ? (string) $status : null,
            'reason' => is_scalar($reason) ? (string) $reason : null,
            'provider_message' => $providerMessage !== null ? substr($providerMessage, 0, 500) : null,
        ]);

        if ($status === 'cancelled') {
            throw new ApiException('LLM_RESPONSE_CANCELLED', 'L’analyse a été annulée.', 409, true);
        }
        if ($status === 'failed') {
            throw new ApiException('LLM_RESPONSE_FAILED', 'Le fournisseur n’a pas pu terminer l’analyse.', 502, true);
        }
        if ($status === 'incomplete') {
            throw new ApiException('LLM_RESPONSE_INCOMPLETE', 'L’analyse du document n’a pas été menée à son terme.', 502, true);
        }
        if (in_array($status, ['queued', 'in_progress'], true)) {
            throw new ApiException('LLM_RESPONSE_PENDING', 'L’analyse est toujours en cours.', 202, true);
        }

        throw new ApiException('INVALID_UPSTREAM_RESPONSE', 'Le fournisseur a renvoyé un état inattendu.', 502, true);
    }

    /**
     * @param array<string, mixed> $decoded
     * @return array<string, mixed>
     */
    private function meta(array $decoded, UpstreamResponse $response): array
    {
        $usage = is_array($decoded['usage'] ?? null) ? $decoded['usage'] : [];
        return [
            'provider_response_id' => is_string($decoded['id'] ?? null) ? $decoded['id'] : null,
            'provider_request_id' => $response->headers['x-request-id'] ?? null,
            'model' => is_string($decoded['model'] ?? null) ? $decoded['model'] : null,
            'usage' => [
                'input_tokens' => is_int($usage['input_tokens'] ?? null) ? $usage['input_tokens'] : null,
                'output_tokens' => is_int($usage['output_tokens'] ?? null) ? $usage['output_tokens'] : null,
                'total_tokens' => is_int($usage['total_tokens'] ?? null) ? $usage['total_tokens'] : null,
            ],
        ];
    }

    private function throwForResponse(UpstreamResponse $response): never
    {
        $status = $response->status;
        $providerCode = null;
        $providerMessage = null;
        try {
            $decoded = json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);
            if (is_array($decoded) && is_array($decoded['error'] ?? null)) {
                $error = $decoded['error'];
                $providerCode = is_scalar($error['code'] ?? null) ? (string) $error['code'] : null;
                $providerMessage = is_scalar($error['message'] ?? null) ? (string) $error['message'] : null;
            }
        } catch (JsonException) {
            // Le statut HTTP reste exploitable même si le corps fournisseur ne l’est pas.
        }

        Diagnostics::write('upstream_rejected', [
            'http_status' => $status,
            'provider_code' => $providerCode,
            'provider_message' => $providerMessage !== null ? substr($providerMessage, 0, 500) : null,
            'provider_request_id' => $response->headers['x-request-id'] ?? null,
        ]);

        if ($status === 401 || $status === 403) {
            throw new ApiException('UPSTREAM_AUTHENTICATION_FAILED', 'Le proxy ne peut pas s’authentifier auprès du fournisseur LLM.', 502, false);
        }
        if ($status === 404) {
            throw new ApiException('BACKGROUND_RESPONSE_NOT_FOUND', 'Le résultat temporaire de cette analyse n’est plus disponible.', 410, true);
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

        $suffix = $providerCode !== null ? " (code fournisseur : {$providerCode})" : '';
        throw new ApiException('UPSTREAM_REJECTED_REQUEST', 'Le fournisseur LLM a rejeté la requête' . $suffix . '.', 502, false);
    }
}
