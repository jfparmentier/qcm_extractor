<?php

declare(strict_types=1);

namespace QcmProxy;

use JsonException;

final class OpenAiResponsesClient
{
    private const ENDPOINT = 'https://api.openai.com/v1/responses';

    public function __construct(private readonly Config $config)
    {
    }

    /** @param array<string, mixed> $payload */
    public function create(array $payload, string $requestId, ?int $timeoutSeconds = null): UpstreamResponse
    {
        try {
            $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            throw new ApiException('SERVER_MISCONFIGURED', 'La requête destinée au fournisseur ne peut pas être encodée.', 503);
        }

        return $this->request(
            method: 'POST',
            url: self::ENDPOINT,
            requestId: $requestId,
            timeoutSeconds: $timeoutSeconds ?? $this->config->requestTimeoutSeconds,
            body: $json,
        );
    }

    public function retrieve(string $responseId, string $requestId): UpstreamResponse
    {
        return $this->request(
            method: 'GET',
            url: self::ENDPOINT . '/' . rawurlencode($responseId),
            requestId: $requestId,
            timeoutSeconds: $this->config->backgroundPollTimeoutSeconds,
            body: null,
        );
    }

    public function cancel(string $responseId, string $requestId): UpstreamResponse
    {
        return $this->request(
            method: 'POST',
            url: self::ENDPOINT . '/' . rawurlencode($responseId) . '/cancel',
            requestId: $requestId,
            timeoutSeconds: $this->config->backgroundPollTimeoutSeconds,
            body: '{}',
        );
    }

    private function request(
        string $method,
        string $url,
        string $requestId,
        int $timeoutSeconds,
        ?string $body,
    ): UpstreamResponse {
        if (!function_exists('curl_init')) {
            throw new ApiException('SERVER_MISCONFIGURED', 'L’extension PHP cURL est requise.', 503);
        }

        $curl = curl_init($url);
        if ($curl === false) {
            throw new ApiException('UPSTREAM_UNAVAILABLE', 'Le fournisseur LLM ne peut pas être contacté.', 503, true);
        }

        $headers = [];
        $responseBody = '';
        $responseTooLarge = false;
        $requestHeaders = [
            'Authorization: Bearer ' . $this->config->apiKey,
            'Accept: application/json',
            'Accept-Encoding: identity',
            'Expect:',
            'User-Agent: qcm-extractor-proxy/3.1.1',
            'X-Client-Request-Id: ' . $requestId,
        ];
        if ($body !== null) {
            $requestHeaders[] = 'Content-Type: application/json';
            $requestHeaders[] = 'Content-Length: ' . strlen($body);
        }
        if ($this->config->openAiProject !== null) {
            $requestHeaders[] = 'OpenAI-Project: ' . $this->config->openAiProject;
        }
        if ($this->config->openAiOrganization !== null) {
            $requestHeaders[] = 'OpenAI-Organization: ' . $this->config->openAiOrganization;
        }

        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $requestHeaders,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => $this->config->connectTimeoutSeconds,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_NOSIGNAL => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$headers): int {
                $length = strlen($line);
                $position = strpos($line, ':');
                if ($position !== false) {
                    $name = strtolower(trim(substr($line, 0, $position)));
                    $value = trim(substr($line, $position + 1));
                    if ($name !== '') {
                        $headers[$name] = $value;
                    }
                }
                return $length;
            },
            CURLOPT_WRITEFUNCTION => function ($handle, string $chunk) use (&$responseBody, &$responseTooLarge): int {
                if (strlen($responseBody) + strlen($chunk) > $this->config->maxUpstreamResponseBytes) {
                    $responseTooLarge = true;
                    return 0;
                }
                $responseBody .= $chunk;
                return strlen($chunk);
            },
        ];
        if ($body !== null) {
            $options[CURLOPT_POSTFIELDS] = $body;
        }
        if (defined('CURL_HTTP_VERSION_1_1')) {
            $options[CURLOPT_HTTP_VERSION] = CURL_HTTP_VERSION_1_1;
        }
        if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
            $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTPS;
        }
        if (defined('CURLOPT_REDIR_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
            $options[CURLOPT_REDIR_PROTOCOLS] = CURLPROTO_HTTPS;
        }

        curl_setopt_array($curl, $options);
        Diagnostics::write('upstream_started', [
            'request_id' => $requestId,
            'method' => $method,
            'payload_bytes' => $body !== null ? strlen($body) : 0,
            'timeout_seconds' => $timeoutSeconds,
        ]);

        $result = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $duration = (float) curl_getinfo($curl, CURLINFO_TOTAL_TIME);
        $errorNumber = curl_errno($curl);
        $errorMessage = curl_error($curl);
        curl_close($curl);

        Diagnostics::write('upstream_finished', [
            'request_id' => $requestId,
            'method' => $method,
            'http_status' => $status,
            'curl_errno' => $errorNumber,
            'curl_error' => $errorMessage !== '' ? substr($errorMessage, 0, 300) : null,
            'duration_ms' => (int) round($duration * 1000),
            'response_bytes' => strlen($responseBody),
        ]);

        if ($responseTooLarge) {
            throw new ApiException('UPSTREAM_RESPONSE_TOO_LARGE', 'La réponse du fournisseur est trop volumineuse.', 502, true);
        }
        if ($result === false || $errorNumber !== 0) {
            $timeoutCode = defined('CURLE_OPERATION_TIMEDOUT') ? CURLE_OPERATION_TIMEDOUT : 28;
            if ($errorNumber === $timeoutCode) {
                throw new ApiException(
                    'UPSTREAM_TIMEOUT',
                    'Le fournisseur LLM n’a pas répondu avant l’expiration du délai réseau.',
                    504,
                    true,
                );
            }

            $sslErrors = array_filter([
                defined('CURLE_SSL_CONNECT_ERROR') ? CURLE_SSL_CONNECT_ERROR : null,
                defined('CURLE_PEER_FAILED_VERIFICATION') ? CURLE_PEER_FAILED_VERIFICATION : null,
                defined('CURLE_SSL_CACERT') ? CURLE_SSL_CACERT : null,
            ], static fn ($value): bool => is_int($value));
            if (in_array($errorNumber, $sslErrors, true)) {
                throw new ApiException(
                    'UPSTREAM_TLS_FAILED',
                    'La connexion TLS vers le fournisseur LLM a échoué. Vérifiez les certificats cURL de PHP/MAMP.',
                    503,
                    false,
                );
            }

            throw new ApiException('UPSTREAM_CONNECTION_FAILED', 'Le fournisseur LLM ne peut pas être contacté.', 503, true);
        }

        return new UpstreamResponse($status, $headers, $responseBody);
    }
}
