import { getDocument } from "pdfjs-dist";
import "./pdfWorker.js?v=7.4.0";
export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;
function isPdfSignature(bytes) {
    if (bytes.byteLength < 5) {
        return false;
    }
    return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}
function normalizeMetadataValue(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function mapPdfError(error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : String(error);
    if (name === "PasswordException") {
        return {
            code: "PDF_PASSWORD_REQUIRED",
            message: "Ce document PDF est protégé par un mot de passe.",
            technicalDetails: message
        };
    }
    if (name === "InvalidPDFException" || name === "FormatError") {
        return {
            code: "PDF_INVALID",
            message: "Le document PDF est invalide ou endommagé.",
            technicalDetails: message
        };
    }
    return {
        code: "PDF_LOAD_FAILED",
        message: "Le document PDF n’a pas pu être chargé.",
        technicalDetails: message
    };
}
export async function loadPdfFromFile(file) {
    if (file.size > MAX_PDF_SIZE_BYTES) {
        throw {
            code: "FILE_TOO_LARGE",
            message: "Le fichier dépasse la limite de 50 Mo.",
            technicalDetails: `${file.size} octets`
        };
    }
    const bytes = await file.arrayBuffer();
    const byteView = new Uint8Array(bytes);
    const mimeLooksValid = file.type === "application/pdf" || file.type === "";
    if (!mimeLooksValid || !isPdfSignature(byteView)) {
        throw {
            code: "INVALID_FILE_TYPE",
            message: "Le fichier sélectionné n’est pas un document PDF valide."
        };
    }
    let loadingTask = null;
    let document = null;
    try {
        loadingTask = getDocument({
            data: byteView.slice(),
            useSystemFonts: true
        });
        document = await loadingTask.promise;
        const metadata = await document.getMetadata().catch(() => null);
        const info = metadata?.info;
        return {
            fileName: file.name,
            fileSize: file.size,
            bytes,
            document,
            pageCount: document.numPages,
            title: normalizeMetadataValue(info?.Title),
            author: normalizeMetadataValue(info?.Author)
        };
    }
    catch (error) {
        await loadingTask?.destroy().catch(() => undefined);
        if (isProjectError(error)) {
            throw error;
        }
        throw mapPdfError(error);
    }
}
export function isProjectError(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    return "code" in value && "message" in value;
}
