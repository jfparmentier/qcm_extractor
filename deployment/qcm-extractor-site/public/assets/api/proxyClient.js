export class ProxyApiError extends Error {
    code;
    retryable;
    httpStatus;
    requestId;
    technicalDetails;
    constructor(code, message, retryable, httpStatus, requestId, technicalDetails) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.httpStatus = httpStatus;
        this.requestId = requestId;
        this.technicalDetails = technicalDetails;
        this.name = "ProxyApiError";
    }
}
const configuredApiBaseUrl = import.meta.env?.VITE_QCM_API_BASE_URL?.trim();
const API_BASE_URL = (configuredApiBaseUrl && configuredApiBaseUrl.length > 0
    ? configuredApiBaseUrl
    : new URL("api", document.baseURI).toString()).replace(/\/$/, "");
export function getProxyDiagnosticUrl() {
    return `${API_BASE_URL}/diagnostic.php`;
}
export async function loadWorkflowConfig(signal) {
    const response = await fetchProxy("workflow-config.php", { method: "GET" }, signal);
    return response.data;
}
function encodeBase64Url(value) {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function responseSnippet(body) {
    const normalized = body
        .replace(/<script[\s\S]*?<\/script>/gi, "[script supprimé]")
        .replace(/\s+/g, " ")
        .trim();
    return normalized === "" ? "(corps vide)" : normalized.slice(0, 1200);
}
async function readResponse(response) {
    const body = await response.text();
    let payload;
    try {
        payload = JSON.parse(body);
    }
    catch {
        const contentType = response.headers.get("Content-Type") ?? "non indiqué";
        const requestId = response.headers.get("X-QCM-Request-Id");
        throw new ProxyApiError("INVALID_PROXY_RESPONSE", "Le proxy PHP a renvoyé une réponse illisible.", response.status >= 500, response.status, requestId, [
            `HTTP ${response.status}`,
            `Type : ${contentType}`,
            `Réponse : ${responseSnippet(body)}`,
            `Diagnostic : ${getProxyDiagnosticUrl()}`
        ].join("\n"));
    }
    const failure = payload;
    if ((!response.ok && response.status !== 202) || failure.ok === false) {
        throw new ProxyApiError(failure.ok === false ? failure.error.code : "PROXY_REQUEST_FAILED", failure.ok === false ? failure.error.message : "La requête au proxy PHP a échoué.", failure.ok === false ? failure.error.retryable : response.status >= 500, response.status, failure.ok === false
            ? failure.request_id ?? response.headers.get("X-QCM-Request-Id")
            : response.headers.get("X-QCM-Request-Id"), `HTTP ${response.status} · ${failure.ok === false ? failure.error.code : "PROXY_REQUEST_FAILED"}\nDiagnostic : ${getProxyDiagnosticUrl()}`);
    }
    return payload;
}
async function fetchProxy(endpoint, init, signal) {
    let response;
    try {
        response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            ...init,
            cache: "no-store",
            credentials: "omit",
            redirect: "error",
            referrerPolicy: "no-referrer",
            signal
        });
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
        }
        throw new ProxyApiError("PROXY_UNREACHABLE", "Le proxy PHP est inaccessible. Vérifiez que le site est servi par Apache/PHP et que l’URL de l’API est correcte.", true, 0, null, `Diagnostic : ${getProxyDiagnosticUrl()}`);
    }
    return readResponse(response);
}
async function sendPdf(endpoint, pdfBytes, filename, context, signal) {
    const headers = new Headers({
        "Content-Type": "application/pdf",
        "X-QCM-Filename": encodeURIComponent(filename)
    });
    if (context !== null) {
        headers.set("X-QCM-Context", encodeBase64Url(context));
    }
    return fetchProxy(endpoint, {
        method: "POST",
        headers,
        body: pdfBytes.slice(0)
    }, signal);
}
function wait(milliseconds, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted === true) {
            reject(new DOMException("Analyse annulée", "AbortError"));
            return;
        }
        const timer = window.setTimeout(resolve, milliseconds);
        signal?.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Analyse annulée", "AbortError"));
        }, { once: true });
    });
}
function isPending(response) {
    return response.status === "queued" || response.status === "in_progress";
}
async function pollJob(endpoint, token, signal) {
    return fetchProxy(endpoint, {
        method: "POST",
        headers: { "X-QCM-Job": token }
    }, signal);
}
async function cancelJob(endpoint, token) {
    await fetchProxy(endpoint, {
        method: "POST",
        headers: { "X-QCM-Job": token }
    });
}
async function runBackgroundPdfJob(endpoints, pdfBytes, filename, context, signal, onProgress) {
    onProgress?.({ providerStatus: "uploading", pollCount: 0, requestId: null });
    let pending = null;
    try {
        const start = await sendPdf(endpoints.start, pdfBytes, filename, context, signal);
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
                throw new ProxyApiError("BACKGROUND_JOB_EXPIRED", "Le résultat temporaire de l’analyse a expiré avant sa récupération.", true, 410, pending.request_id);
            }
            await wait(Math.min(pending.job.poll_after_ms, remainingMilliseconds), signal);
            pollCount += 1;
            const polled = await pollJob(endpoints.status, pending.job.token, signal);
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
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError" && pending !== null) {
            void cancelJob(endpoints.cancel, pending.job.token).catch(() => undefined);
        }
        throw error;
    }
}
export function analyzeDocumentMap(pdfBytes, filename, signal, onProgress) {
    return runBackgroundPdfJob({
        start: "analyze-map.php",
        status: "mapping-status.php",
        cancel: "mapping-cancel.php"
    }, pdfBytes, filename, null, signal, onProgress);
}
export function extractQuestions(pdfBytes, filename, context, signal, onProgress) {
    return runBackgroundPdfJob({
        start: "extract-questions.php",
        status: "extraction-status.php",
        cancel: "extraction-cancel.php"
    }, pdfBytes, filename, context, signal, onProgress);
}
