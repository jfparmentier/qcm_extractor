export class ProxyApiError extends Error {
    code;
    retryable;
    httpStatus;
    requestId;
    constructor(code, message, retryable, httpStatus, requestId) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.httpStatus = httpStatus;
        this.requestId = requestId;
        this.name = "ProxyApiError";
    }
}
const configuredApiBaseUrl = import.meta.env?.VITE_QCM_API_BASE_URL?.trim();
const API_BASE_URL = (configuredApiBaseUrl && configuredApiBaseUrl.length > 0
    ? configuredApiBaseUrl
    : new URL("api", document.baseURI).toString()).replace(/\/$/, "");
function encodeBase64Url(value) {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function readResponse(response) {
    let payload;
    try {
        payload = (await response.json());
    }
    catch {
        throw new ProxyApiError("INVALID_PROXY_RESPONSE", "Le proxy PHP a renvoyé une réponse illisible.", response.status >= 500, response.status, response.headers.get("X-QCM-Request-Id"));
    }
    if (!response.ok || payload.ok === false) {
        const failure = payload.ok === false ? payload : null;
        throw new ProxyApiError(failure?.error.code ?? "PROXY_REQUEST_FAILED", failure?.error.message ?? "La requête au proxy PHP a échoué.", failure?.error.retryable ?? response.status >= 500, response.status, failure?.request_id ?? response.headers.get("X-QCM-Request-Id"));
    }
    return payload;
}
async function sendPdf(endpoint, pdfBytes, filename, context, signal) {
    const headers = new Headers({
        "Content-Type": "application/pdf",
        "X-QCM-Filename": encodeURIComponent(filename)
    });
    if (context !== null) {
        headers.set("X-QCM-Context", encodeBase64Url(context));
    }
    let response;
    try {
        response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            method: "POST",
            headers,
            body: pdfBytes.slice(0),
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
        throw new ProxyApiError("PROXY_UNREACHABLE", "Le proxy PHP est inaccessible. Vérifiez que le site est servi par Apache/PHP et que l’URL de l’API est correcte.", true, 0, null);
    }
    return readResponse(response);
}
export function analyzeDocumentMap(pdfBytes, filename, signal) {
    return sendPdf("analyze-map.php", pdfBytes, filename, null, signal);
}
export function extractQuestions(pdfBytes, filename, context, signal) {
    return sendPdf("extract-questions.php", pdfBytes, filename, context, signal);
}
