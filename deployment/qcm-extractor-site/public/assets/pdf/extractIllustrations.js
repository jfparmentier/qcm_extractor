const TARGET_PAGE_WIDTH_PX = 2400;
const MAX_PAGE_PIXELS = 18_000_000;
const MIN_USEFUL_WIDTH_PX = 160;
const MIN_USEFUL_HEIGHT_PX = 100;
const WHITE_THRESHOLD = 250;
export class IllustrationGenerationError extends Error {
    candidateId;
    constructor(message, candidateId = null) {
        super(message);
        this.candidateId = candidateId;
        this.name = "IllustrationGenerationError";
    }
}
function assertNotAborted(signal) {
    if (signal.aborted) {
        throw new DOMException("Génération annulée", "AbortError");
    }
}
function canvasContext(canvas, alpha = false) {
    const context = canvas.getContext("2d", { alpha });
    if (context === null) {
        throw new IllustrationGenerationError("Le navigateur ne permet pas de créer le contexte graphique nécessaire.");
    }
    return context;
}
function isWhitePixel(data, offset) {
    return (data[offset] ?? 0) >= WHITE_THRESHOLD &&
        (data[offset + 1] ?? 0) >= WHITE_THRESHOLD &&
        (data[offset + 2] ?? 0) >= WHITE_THRESHOLD;
}
export function makeWhitePixelsTransparent(data) {
    for (let offset = 0; offset < data.length; offset += 4) {
        if (isWhitePixel(data, offset))
            data[offset + 3] = 0;
    }
}
function makeWhiteTransparent(context, width, height) {
    const image = context.getImageData(0, 0, width, height);
    makeWhitePixelsTransparent(image.data);
    context.putImageData(image, 0, 0);
}
function computeScale(page) {
    const base = page.getViewport({ scale: 1 });
    const widthScale = TARGET_PAGE_WIDTH_PX / Math.max(1, base.width);
    const pixelScale = Math.sqrt(MAX_PAGE_PIXELS / Math.max(1, base.width * base.height));
    return Math.max(1, Math.min(widthScale, pixelScale, 4));
}
async function renderPage(document, pageNumber, signal) {
    assertNotAborted(signal);
    const page = await document.getPage(pageNumber);
    assertNotAborted(signal);
    const viewport = page.getViewport({ scale: computeScale(page) });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvasContext(canvas);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const renderTask = page.render({ canvas, canvasContext: context, viewport });
    const cancel = () => renderTask.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
        await renderTask.promise;
    }
    catch (error) {
        if (signal.aborted) {
            throw new DOMException("Génération annulée", "AbortError");
        }
        throw new IllustrationGenerationError(`Le rendu de la page ${pageNumber} a échoué : ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        signal.removeEventListener("abort", cancel);
    }
    return { page, canvas };
}
function cropBounds(candidate, sourceCanvas) {
    const left = Math.max(0, Math.floor(candidate.bbox.x * sourceCanvas.width));
    const top = Math.max(0, Math.floor(candidate.bbox.y * sourceCanvas.height));
    const right = Math.min(sourceCanvas.width, Math.ceil((candidate.bbox.x + candidate.bbox.width) * sourceCanvas.width));
    const bottom = Math.min(sourceCanvas.height, Math.ceil((candidate.bbox.y + candidate.bbox.height) * sourceCanvas.height));
    const width = right - left;
    const height = bottom - top;
    if (width < 1 || height < 1) {
        throw new IllustrationGenerationError("La zone d’image ne contient aucun pixel après conversion.", candidate.id);
    }
    return { left, top, width, height };
}
function canvasToPng(canvas, candidateId) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob === null) {
                reject(new IllustrationGenerationError("La conversion de l’illustration en PNG a échoué.", candidateId));
                return;
            }
            resolve(blob);
        }, "image/png");
    });
}
async function cropCandidate(candidate, sourceCanvas, signal) {
    assertNotAborted(signal);
    const bounds = cropBounds(candidate, sourceCanvas);
    const cropCanvas = window.document.createElement("canvas");
    cropCanvas.width = bounds.width;
    cropCanvas.height = bounds.height;
    const context = canvasContext(cropCanvas, true);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceCanvas, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    makeWhiteTransparent(context, bounds.width, bounds.height);
    const blob = await canvasToPng(cropCanvas, candidate.id);
    assertNotAborted(signal);
    const generationWarnings = [];
    if (bounds.width < MIN_USEFUL_WIDTH_PX || bounds.height < MIN_USEFUL_HEIGHT_PX) {
        generationWarnings.push(`La découpe mesure seulement ${bounds.width} × ${bounds.height} px ; sa lisibilité devra être vérifiée.`);
    }
    if (blob.size > 8 * 1024 * 1024) {
        generationWarnings.push("Le fichier PNG dépasse 8 Mio.");
    }
    cropCanvas.width = 1;
    cropCanvas.height = 1;
    return {
        ...candidate,
        blob,
        previewUrl: URL.createObjectURL(blob),
        width: bounds.width,
        height: bounds.height,
        byteLength: blob.size,
        mimeType: "image/png",
        generatedAt: Date.now(),
        generationWarnings
    };
}
export async function generateIllustrationAssets(document, candidates, signal, onProgress) {
    if (candidates.length === 0)
        return [];
    const byPage = new Map();
    candidates.forEach((candidate) => {
        const existing = byPage.get(candidate.sourcePage) ?? [];
        byPage.set(candidate.sourcePage, [...existing, candidate]);
    });
    const generated = [];
    const pages = [...byPage.keys()].sort((left, right) => left - right);
    let completed = 0;
    try {
        for (const pageNumber of pages) {
            assertNotAborted(signal);
            const pageCandidates = byPage.get(pageNumber) ?? [];
            const rendered = await renderPage(document, pageNumber, signal);
            try {
                for (const candidate of pageCandidates) {
                    assertNotAborted(signal);
                    onProgress?.({
                        completed,
                        total: candidates.length,
                        currentPage: pageNumber,
                        currentCandidateId: candidate.id
                    });
                    const asset = await cropCandidate(candidate, rendered.canvas, signal);
                    generated.push(asset);
                    completed += 1;
                    onProgress?.({
                        completed,
                        total: candidates.length,
                        currentPage: pageNumber,
                        currentCandidateId: candidate.id
                    });
                }
            }
            finally {
                rendered.canvas.width = 1;
                rendered.canvas.height = 1;
                rendered.page.cleanup();
            }
        }
        onProgress?.({ completed, total: candidates.length, currentPage: null, currentCandidateId: null });
        return generated;
    }
    catch (error) {
        generated.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
        throw error;
    }
}
