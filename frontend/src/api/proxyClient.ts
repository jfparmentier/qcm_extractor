export interface ProxySuccess<TData> {
  readonly ok: true;
  readonly request_id: string;
  readonly operation: "analyze-map" | "extract-questions";
  readonly data: TData;
  readonly meta: {
    readonly provider_response_id: string | null;
    readonly provider_request_id: string | null;
    readonly model: string | null;
    readonly usage: {
      readonly input_tokens: number | null;
      readonly output_tokens: number | null;
      readonly total_tokens: number | null;
    };
  };
}

export interface ProxyFailure {
  readonly ok: false;
  readonly request_id?: string;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  };
}

export class ProxyApiError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly httpStatus: number,
    public readonly requestId: string | null
  ) {
    super(message);
    this.name = "ProxyApiError";
  }
}

export interface ExtractionContext {
  readonly batch_id?: string;
  readonly segment_ids?: readonly string[];
  readonly original_page_numbers?: readonly number[];
  readonly segment_page_map?: Readonly<Record<string, readonly number[]>>;
}

const configuredApiBaseUrl = import.meta.env.VITE_QCM_API_BASE_URL?.trim();
const API_BASE_URL = (
  configuredApiBaseUrl && configuredApiBaseUrl.length > 0
    ? configuredApiBaseUrl
    : new URL("api", document.baseURI).toString()
).replace(/\/$/, "");

function encodeBase64Url(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function readResponse<TData>(response: Response): Promise<ProxySuccess<TData>> {
  let payload: ProxySuccess<TData> | ProxyFailure;
  try {
    payload = (await response.json()) as ProxySuccess<TData> | ProxyFailure;
  } catch {
    throw new ProxyApiError(
      "INVALID_PROXY_RESPONSE",
      "Le proxy PHP a renvoyé une réponse illisible.",
      response.status >= 500,
      response.status,
      response.headers.get("X-QCM-Request-Id")
    );
  }

  if (!response.ok || payload.ok === false) {
    const failure = payload.ok === false ? payload : null;
    throw new ProxyApiError(
      failure?.error.code ?? "PROXY_REQUEST_FAILED",
      failure?.error.message ?? "La requête au proxy PHP a échoué.",
      failure?.error.retryable ?? response.status >= 500,
      response.status,
      failure?.request_id ?? response.headers.get("X-QCM-Request-Id")
    );
  }

  return payload;
}

async function sendPdf<TData>(
  endpoint: "analyze-map.php" | "extract-questions.php",
  pdfBytes: ArrayBuffer,
  filename: string,
  context: ExtractionContext | null,
  signal?: AbortSignal
): Promise<ProxySuccess<TData>> {
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "X-QCM-Filename": encodeURIComponent(filename)
  });

  if (context !== null) {
    headers.set("X-QCM-Context", encodeBase64Url(context));
  }

  const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers,
    body: pdfBytes.slice(0),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal
  });

  return readResponse<TData>(response);
}

export function analyzeDocumentMap<TData>(
  pdfBytes: ArrayBuffer,
  filename: string,
  signal?: AbortSignal
): Promise<ProxySuccess<TData>> {
  return sendPdf<TData>("analyze-map.php", pdfBytes, filename, null, signal);
}

export function extractQuestions<TData>(
  pdfBytes: ArrayBuffer,
  filename: string,
  context: ExtractionContext,
  signal?: AbortSignal
): Promise<ProxySuccess<TData>> {
  return sendPdf<TData>("extract-questions.php", pdfBytes, filename, context, signal);
}
