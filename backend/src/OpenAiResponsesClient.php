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
    public function create(array $payload, string $requestId): UpstreamResponse
    {
        if (!function_exists('curl_init')) {
            throw new ApiException('SERVER_MISCONFIGURED', 'L’extension PHP cURL est requise.', 503);
        }

        try {
            $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            throw new ApiException('SERVER_MISCONFIGURED', 'La requête destinée au fournisseur ne peut pas être encodée.', 503);
        }

        $curl = curl_init(self::ENDPOINT);
        if ($curl === false) {
            throw new ApiException('UPSTREAM_UNAVAILABLE', 'Le fournisseur LLM ne peut pas être contacté.', 503, true);
        }

        $headers = [];
        $body = '';
        $responseTooLarge = false;
        $requestHeaders = [
            'Authorization: Bearer ' . $this->config->apiKey,
            'Content-Type: application/json',
            'Content-Length: ' . strlen($json),
            'Accept: application/json',
            'Accept-Encoding: identity',
            'Expect:',
            'User-Agent: qcm-extractor-proxy/3.0.3',
            'X-Client-Request-Id: ' . $requestId,
        ];
        if ($this->config->openAiProject !== null) {
            $requestHeaders[] = 'OpenAI-Project: ' . $this->config->openAiProject;
        }
        if ($this->config->openAiOrganization !== null) {
            $requestHeaders[] = 'OpenAI-Organization: ' . $this->config->openAiOrganization;
        }

        $options = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => $requestHeaders,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => $this->config->connectTimeoutSeconds,
            CURLOPT_TIMEOUT => $this->config->requestTimeoutSeconds,
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
            CURLOPT_WRITEFUNCTION => function ($handle, string $chunk) use (&$body, &$responseTooLarge): int {
                if (strlen($body) + strlen($chunk) > $this->config->maxUpstreamResponseBytes) {
                    $responseTooLarge = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
        ];
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
            'payload_bytes' => strlen($json),
            'timeout_seconds' => $this->config->requestTimeoutSeconds,
        ]);

        $result = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $duration = (float) curl_getinfo($curl, CURLINFO_TOTAL_TIME);
        $errorNumber = curl_errno($curl);
        $errorMessage = curl_error($curl);
        curl_close($curl);

        Diagnostics::write('upstream_finished', [
            'request_id' => $requestId,
            'http_status' => $status,
            'curl_errno' => $errorNumber,
            'curl_error' => $errorMessage !== '' ? substr($errorMessage, 0, 300) : null,
            'duration_ms' => (int) round($duration * 1000),
            'response_bytes' => strlen($body),
        ]);

        if ($responseTooLarge) {
            throw new ApiException('UPSTREAM_RESPONSE_TOO_LARGE', 'La réponse du fournisseur est trop volumineuse.', 502, true);
        }
        if ($result === false || $errorNumber !== 0) {
            $timeoutCode = defined('CURLE_OPERATION_TIMEDOUT') ? CURLE_OPERATION_TIMEDOUT : 28;
            if ($errorNumber === $timeoutCode) {
                throw new ApiException(
                    'UPSTREAM_TIMEOUT',
                    'Le fournisseur LLM n’a pas terminé l’analyse avant l’expiration du délai.',
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

        return new UpstreamResponse($status, $headers, $body);
    }
}
