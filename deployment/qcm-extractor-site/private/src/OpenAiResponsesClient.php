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
            'Accept: application/json',
            'Accept-Encoding: identity',
            'User-Agent: qcm-extractor-proxy/2.0',
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
        if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
            $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTPS;
        }
        if (defined('CURLOPT_REDIR_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
            $options[CURLOPT_REDIR_PROTOCOLS] = CURLPROTO_HTTPS;
        }

        curl_setopt_array($curl, $options);
        $result = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $errorNumber = curl_errno($curl);
        curl_close($curl);

        if ($responseTooLarge) {
            throw new ApiException('UPSTREAM_RESPONSE_TOO_LARGE', 'La réponse du fournisseur est trop volumineuse.', 502, true);
        }
        if ($result === false || $errorNumber !== 0) {
            throw new ApiException('UPSTREAM_UNAVAILABLE', 'Le fournisseur LLM ne peut pas être contacté.', 503, true);
        }

        return new UpstreamResponse($status, $headers, $body);
    }
}
