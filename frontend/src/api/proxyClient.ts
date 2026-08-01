export interface ProxyResponseMeta {
  readonly provider_response_id: string | null;
  readonly provider_request_id: string | null;
  readonly model: string | null;
  readonly usage: {
    readonly input_tokens: number | null;
    readonly output_tokens: number | null;
    readonly total_tokens: number | null;
  };
}

export type ProxyOperation = "analyze-map" | "extract-questions";

export interface WorkflowConfig {
  readonly batch: {
    readonly maxQuestionsPerBatch: number;
    readonly maxPagesPerBatch: number;
    readonly maxEstimatedBytes: number;
    readonly contextPaddingPages: number;
    readonly maxGapPages: number;
  };
  readonly extraction: {
    readonly maxConcurrentBatches: number;
    readonly maxRetries: number;
  };
}

interface WorkflowConfigResponse {
  readonly ok: true;
  readonly data: WorkflowConfig;
}

export interface ProxySuccess<TData> {
  readonly ok: true;
  readonly request_id: string;
  readonly operation: ProxyOperation;
  readonly status?: "completed";
  readonly data: TData;
  readonly meta: ProxyResponseMeta;
}

export interface ProxyJobPending {
  readonly ok: true;
  readonly request_id: string;
  readonly operation: ProxyOperation;
  readonly status: "queued" | "in_progress";
  readonly job: {
    readonly token: string;
    readonly expires_at: number;
    readonly poll_after_ms: number;
  };
  readonly meta: ProxyResponseMeta;
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

export interface JobProgress {
  readonly providerStatus: "uploading" | "queued" | "in_progress";
  readonly pollCount: number;
  readonly requestId: string | null;
}

export type MappingProgress = JobProgress;
export type ExtractionProgress = JobProgress;

export class ProxyApiError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly httpStatus: number,
    public readonly requestId: string | null,
    public readonly technicalDetails?: string
  ) {
    super(message);
    this.name = "ProxyApiError";
  }
}

export interface ExtractionContextRegion {
  readonly source_page: number;
  readonly local_page: number;
  readonly role:
    | "question"
    | "choices"
    | "answer"
    | "feedback"
    | "essential_image"
    | "decorative_image"
    | "context";
  readonly bbox: readonly [number, number, number, number];
}

export interface ExtractionContextSegment {
  readonly id: string;
  readonly question_number: string | null;
  readonly question_type_hint: "single_choice" | "multiple_choice" | "true_false" | "unknown";
  readonly source_pages: readonly number[];
  readonly local_pages: readonly number[];
  readonly contains_essential_image: boolean;
  readonly regions: readonly ExtractionContextRegion[];
}

export interface ExtractionContext {
  readonly batch_id: string;
  readonly segment_ids: readonly string[];
  readonly original_page_numbers: readonly number[];
  readonly local_to_original_page_map: readonly number[];
  readonly segment_page_map: Readonly<Record<string, readonly number[]>>;
  readonly segments: readonly ExtractionContextSegment[];
}

const configuredApiBaseUrl = import.meta.env?.VITE_QCM_API_BASE_URL?.trim();
const API_BASE_URL = (
  configuredApiBaseUrl && configuredApiBaseUrl.length > 0
    ? configuredApiBaseUrl
    : new URL("api", document.baseURI).toString()
).replace(/\/$/, "");

export function getProxyDiagnosticUrl(): string {
  return `${API_BASE_URL}/diagnostic.php`;
}

export async function loadWorkflowConfig(signal?: AbortSignal): Promise<WorkflowConfig> {
  const response = await fetchProxy<WorkflowConfigResponse>(
    "workflow-config.php",
    { method: "GET" },
    signal
  );
  return response.data;
}

function encodeBase64Url(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function responseSnippet(body: string): string {
  const normalized = body
    .replace(/<script[\s\S]*?<\/script>/gi, "[script supprimé]")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "" ? "(corps vide)" : normalized.slice(0, 1200);
}

async function readResponse<TPayload>(response: Response): Promise<TPayload> {
  const body = await response.text();
  let payload: TPayload | ProxyFailure;
  try {
    payload = JSON.parse(body) as TPayload | ProxyFailure;
  } catch {
    const contentType = response.headers.get("Content-Type") ?? "non indiqué";
    const requestId = response.headers.get("X-QCM-Request-Id");
    throw new ProxyApiError(
      "INVALID_PROXY_RESPONSE",
      "Le proxy PHP a renvoyé une réponse illisible.",
      response.status >= 500,
      response.status,
      requestId,
      [
        `HTTP ${response.status}`,
        `Type : ${contentType}`,
        `Réponse : ${responseSnippet(body)}`,
        `Diagnostic : ${getProxyDiagnosticUrl()}`
      ].join("\n")
    );
  }

  const failure = payload as ProxyFailure;
  if ((!response.ok && response.status !== 202) || failure.ok === false) {
    throw new ProxyApiError(
      failure.ok === false ? failure.error.code : "PROXY_REQUEST_FAILED",
      failure.ok === false ? failure.error.message : "La requête au proxy PHP a échoué.",
      failure.ok === false ? failure.error.retryable : response.status >= 500,
      response.status,
      failure.ok === false
        ? failure.request_id ?? response.headers.get("X-QCM-Request-Id")
        : response.headers.get("X-QCM-Request-Id"),
      `HTTP ${response.status} · ${failure.ok === false ? failure.error.code : "PROXY_REQUEST_FAILED"}\nDiagnostic : ${getProxyDiagnosticUrl()}`
    );
  }

  return payload as TPayload;
}

async function fetchProxy<TPayload>(
  endpoint: string,
  init: RequestInit,
  signal?: AbortSignal
): Promise<TPayload> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      ...init,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ProxyApiError(
      "PROXY_UNREACHABLE",
      "Le proxy PHP est inaccessible. Vérifiez que le site est servi par Apache/PHP et que l’URL de l’API est correcte.",
      true,
      0,
      null,
      `Diagnostic : ${getProxyDiagnosticUrl()}`
    );
  }

  return readResponse<TPayload>(response);
}

async function sendPdf<TPayload>(
  endpoint: "analyze-map.php" | "extract-questions.php",
  pdfBytes: ArrayBuffer,
  filename: string,
  context: ExtractionContext | null,
  signal?: AbortSignal
): Promise<TPayload> {
  const headers = new Headers({
    "Content-Type": "application/pdf",
    "X-QCM-Filename": encodeURIComponent(filename)
  });

  if (context !== null) {
    headers.set("X-QCM-Context", encodeBase64Url(context));
  }

  return fetchProxy<TPayload>(
    endpoint,
    {
      method: "POST",
      headers,
      body: pdfBytes.slice(0)
    },
    signal
  );
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new DOMException("Analyse annulée", "AbortError"));
      return;
    }

    const timer = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Analyse annulée", "AbortError"));
      },
      { once: true }
    );
  });
}

function isPending<TData>(
  response: ProxySuccess<TData> | ProxyJobPending
): response is ProxyJobPending {
  return response.status === "queued" || response.status === "in_progress";
}

interface BackgroundEndpoints {
  readonly start: "analyze-map.php" | "extract-questions.php";
  readonly status: "mapping-status.php" | "extraction-status.php";
  readonly cancel: "mapping-cancel.php" | "extraction-cancel.php";
}

async function pollJob<TData>(
  endpoint: BackgroundEndpoints["status"],
  token: string,
  signal?: AbortSignal
): Promise<ProxySuccess<TData> | ProxyJobPending> {
  return fetchProxy<ProxySuccess<TData> | ProxyJobPending>(
    endpoint,
    {
      method: "POST",
      headers: { "X-QCM-Job": token }
    },
    signal
  );
}

async function cancelJob(
  endpoint: BackgroundEndpoints["cancel"],
  token: string
): Promise<void> {
  await fetchProxy<{ readonly ok: true }>(
    endpoint,
    {
      method: "POST",
      headers: { "X-QCM-Job": token }
    }
  );
}

async function runBackgroundPdfJob<TData>(
  endpoints: BackgroundEndpoints,
  pdfBytes: ArrayBuffer,
  filename: string,
  context: ExtractionContext | null,
  signal?: AbortSignal,
  onProgress?: (progress: JobProgress) => void
): Promise<ProxySuccess<TData>> {
  onProgress?.({ providerStatus: "uploading", pollCount: 0, requestId: null });
  let pending: ProxyJobPending | null = null;

  try {
    const start = await sendPdf<ProxySuccess<TData> | ProxyJobPending>(
      endpoints.start,
      pdfBytes,
      filename,
      context,
      signal
    );

    if (!isPending(start)) {
      return start;
    }

    pending = start;
    let pollCount = 0;
    onProgress?.({
      providerStatus: start.status,
      pollCount,
      requestId: start.request_id
    });

    while (true) {
      const remainingMilliseconds = pending.job.expires_at * 1000 - Date.now();
      if (remainingMilliseconds <= 0) {
        throw new ProxyApiError(
          "BACKGROUND_JOB_EXPIRED",
          "Le résultat temporaire de l’analyse a expiré avant sa récupération.",
          true,
          410,
          pending.request_id
        );
      }

      await wait(Math.min(pending.job.poll_after_ms, remainingMilliseconds), signal);
      pollCount += 1;
      const polled: ProxySuccess<TData> | ProxyJobPending = await pollJob<TData>(
        endpoints.status,
        pending.job.token,
        signal
      );
      if (!isPending(polled)) {
        return polled;
      }

      pending = polled;
      onProgress?.({
        providerStatus: polled.status,
        pollCount,
        requestId: polled.request_id
      });
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError" && pending !== null) {
      void cancelJob(endpoints.cancel, pending.job.token).catch(() => undefined);
    }
    throw error;
  }
}

export function analyzeDocumentMap<TData>(
  pdfBytes: ArrayBuffer,
  filename: string,
  signal?: AbortSignal,
  onProgress?: (progress: MappingProgress) => void
): Promise<ProxySuccess<TData>> {
  return runBackgroundPdfJob<TData>(
    {
      start: "analyze-map.php",
      status: "mapping-status.php",
      cancel: "mapping-cancel.php"
    },
    pdfBytes,
    filename,
    null,
    signal,
    onProgress
  );
}

export function extractQuestions<TData>(
  pdfBytes: ArrayBuffer,
  filename: string,
  context: ExtractionContext,
  signal?: AbortSignal,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ProxySuccess<TData>> {
  return runBackgroundPdfJob<TData>(
    {
      start: "extract-questions.php",
      status: "extraction-status.php",
      cancel: "extraction-cancel.php"
    },
    pdfBytes,
    filename,
    context,
    signal,
    onProgress
  );
}
