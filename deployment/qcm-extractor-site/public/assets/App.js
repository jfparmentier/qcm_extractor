import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { INITIAL_PROJECT_STATE, ZOOM_STEP, projectReducer } from "./domain/projectState.js";
import { DocumentMapValidationError, createUserRegionId, validateAndNormalizeDocumentMap } from "./domain/documentMap.js";
import { analyzeDocumentMap, extractQuestions, ProxyApiError } from "./api/proxyClient.js";
import { createBatchPlan } from "./domain/batchPlan.js";
import { createSubPdf, SubPdfGenerationError } from "./pdf/createSubPdf.js";
import { createExtractionContext } from "./domain/extractionContext.js";
import { ExtractionValidationError, validateAndNormalizeExtractionResult } from "./domain/extraction.js";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation.js";
import { isProjectError, loadPdfFromFile } from "./pdf/loadPdf.js";
import { ErrorPanel } from "./components/ErrorPanel.js";
import { FileDropZone } from "./components/FileDropZone.js";
import { LoadingPanel } from "./components/LoadingPanel.js";
import { PdfViewer } from "./components/PdfViewer.js";
function toMappingError(error) {
    if (error instanceof ProxyApiError) {
        return {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            requestId: error.requestId,
            technicalDetails: error.technicalDetails ?? (error.httpStatus > 0 ? `HTTP ${error.httpStatus} · ${error.code}` : error.code)
        };
    }
    if (error instanceof DocumentMapValidationError) {
        return {
            code: "INVALID_DOCUMENT_MAP",
            message: error.message,
            retryable: true,
            requestId: null,
            technicalDetails: error.issues.join("\n")
        };
    }
    return {
        code: "MAPPING_FAILED",
        message: "Une erreur inattendue a empêché la cartographie du document.",
        retryable: true,
        requestId: null,
        technicalDetails: error instanceof Error ? error.message : String(error)
    };
}
function toExtractionError(error) {
    if (error instanceof ProxyApiError) {
        return {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            requestId: error.requestId,
            technicalDetails: error.technicalDetails
        };
    }
    if (error instanceof ExtractionValidationError) {
        return {
            code: "INVALID_EXTRACTION_RESULT",
            message: error.message,
            retryable: true,
            requestId: null,
            technicalDetails: error.issues.join("\n")
        };
    }
    return {
        code: "EXTRACTION_FAILED",
        message: "Une erreur inattendue a empêché l’extraction de ce lot.",
        retryable: true,
        requestId: null,
        technicalDetails: error instanceof Error ? error.message : String(error)
    };
}
function artifactArrayBuffer(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}
function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
export default function App() {
    const [state, dispatch] = useReducer(projectReducer, INITIAL_PROJECT_STATE);
    const activeDocumentRef = useRef(state.pdf?.document ?? null);
    const loadSequenceRef = useRef(0);
    const mappingAbortRef = useRef(null);
    const batchGenerationSequenceRef = useRef(0);
    const extractionRunSequenceRef = useRef(0);
    const extractionControllersRef = useRef(new Map());
    useEffect(() => {
        activeDocumentRef.current = state.pdf?.document ?? null;
    }, [state.pdf]);
    useEffect(() => {
        return () => {
            mappingAbortRef.current?.abort();
            extractionRunSequenceRef.current += 1;
            extractionControllersRef.current.forEach((controller) => controller.abort());
            extractionControllersRef.current.clear();
            void activeDocumentRef.current?.loadingTask.destroy();
        };
    }, []);
    const closeDocument = useCallback(() => {
        loadSequenceRef.current += 1;
        mappingAbortRef.current?.abort();
        mappingAbortRef.current = null;
        batchGenerationSequenceRef.current += 1;
        extractionRunSequenceRef.current += 1;
        extractionControllersRef.current.forEach((controller) => controller.abort());
        extractionControllersRef.current.clear();
        const document = activeDocumentRef.current;
        activeDocumentRef.current = null;
        dispatch({ type: "RESET" });
        void document?.loadingTask.destroy();
    }, []);
    const handleFileSelected = useCallback(async (file) => {
        const sequence = loadSequenceRef.current + 1;
        loadSequenceRef.current = sequence;
        mappingAbortRef.current?.abort();
        mappingAbortRef.current = null;
        batchGenerationSequenceRef.current += 1;
        extractionRunSequenceRef.current += 1;
        extractionControllersRef.current.forEach((controller) => controller.abort());
        extractionControllersRef.current.clear();
        const previousDocument = activeDocumentRef.current;
        activeDocumentRef.current = null;
        dispatch({ type: "LOAD_STARTED" });
        await previousDocument?.loadingTask.destroy().catch(() => undefined);
        try {
            const pdf = await loadPdfFromFile(file);
            if (loadSequenceRef.current !== sequence) {
                await pdf.document.loadingTask.destroy();
                return;
            }
            activeDocumentRef.current = pdf.document;
            dispatch({ type: "LOAD_SUCCEEDED", pdf });
        }
        catch (error) {
            if (loadSequenceRef.current !== sequence) {
                return;
            }
            dispatch({
                type: "LOAD_FAILED",
                error: isProjectError(error)
                    ? error
                    : {
                        code: "PDF_LOAD_FAILED",
                        message: "Une erreur inattendue a empêché le chargement du document.",
                        technicalDetails: error instanceof Error ? error.message : String(error)
                    }
            });
        }
    }, []);
    const analyzeMapping = useCallback(async () => {
        const pdf = state.pdf;
        if (pdf === null || state.mapping.status === "running") {
            return;
        }
        const controller = new AbortController();
        mappingAbortRef.current?.abort();
        mappingAbortRef.current = controller;
        dispatch({ type: "MAPPING_STARTED", startedAt: Date.now() });
        try {
            const response = await analyzeDocumentMap(pdf.bytes, pdf.fileName, controller.signal, (progress) => {
                if (mappingAbortRef.current === controller) {
                    dispatch({ type: "MAPPING_PROGRESS", progress });
                }
            });
            const { documentMap } = validateAndNormalizeDocumentMap(response.data, pdf.pageCount);
            if (mappingAbortRef.current !== controller) {
                return;
            }
            mappingAbortRef.current = null;
            dispatch({ type: "MAPPING_SUCCEEDED", documentMap, meta: response.meta });
        }
        catch (error) {
            if (mappingAbortRef.current !== controller) {
                return;
            }
            mappingAbortRef.current = null;
            if (error instanceof DOMException && error.name === "AbortError") {
                dispatch({ type: "MAPPING_CANCELLED" });
                return;
            }
            dispatch({ type: "MAPPING_FAILED", error: toMappingError(error) });
        }
    }, [state.mapping.status, state.pdf]);
    const cancelMapping = useCallback(() => {
        mappingAbortRef.current?.abort();
        mappingAbortRef.current = null;
        dispatch({ type: "MAPPING_CANCELLED" });
    }, []);
    const setPage = useCallback((page) => {
        dispatch({ type: "SET_PAGE", page });
    }, []);
    const selectSegment = useCallback((segmentId) => {
        dispatch({ type: "SELECT_SEGMENT", segmentId });
    }, []);
    const selectRegion = useCallback((segmentId, regionId) => {
        dispatch({ type: "SELECT_REGION", segmentId, regionId });
    }, []);
    const updateRegionBbox = useCallback((segmentId, regionId, bbox) => {
        dispatch({ type: "UPDATE_REGION_BBOX", segmentId, regionId, bbox });
    }, []);
    const updateRegionRole = useCallback((segmentId, regionId, role) => {
        dispatch({ type: "UPDATE_REGION_ROLE", segmentId, regionId, role });
    }, []);
    const addRegion = useCallback((segmentId, page, role, bbox) => {
        dispatch({
            type: "ADD_REGION",
            segmentId,
            region: {
                client_id: createUserRegionId(segmentId),
                page,
                role,
                bbox,
                origin: "user"
            }
        });
    }, []);
    const deleteRegion = useCallback((segmentId, regionId) => {
        dispatch({ type: "DELETE_REGION", segmentId, regionId });
    }, []);
    const updateBatchSettings = useCallback((settings) => {
        batchGenerationSequenceRef.current += 1;
        dispatch({ type: "BATCH_SETTINGS_UPDATED", settings });
    }, []);
    const planBatches = useCallback(() => {
        if (state.pdf === null || state.mapping.data === null) {
            return;
        }
        batchGenerationSequenceRef.current += 1;
        const plan = createBatchPlan(state.mapping.data, state.pdf.fileSize, state.pdf.pageCount, state.batching.settings);
        dispatch({ type: "BATCHES_PLANNED", plan });
    }, [state.batching.settings, state.mapping.data, state.pdf]);
    const generatePlannedBatch = useCallback(async (batchId) => {
        const pdf = state.pdf;
        const batch = state.batching.plan?.batches.find((candidate) => candidate.id === batchId);
        if (pdf === null || batch === undefined || state.batching.activeBatchId !== null) {
            return;
        }
        const sequence = batchGenerationSequenceRef.current + 1;
        batchGenerationSequenceRef.current = sequence;
        dispatch({ type: "BATCH_GENERATION_STARTED", batchId });
        try {
            const artifact = await createSubPdf(pdf.bytes, pdf.fileName, batch);
            if (batchGenerationSequenceRef.current !== sequence) {
                return;
            }
            dispatch({ type: "BATCH_GENERATED", artifact });
        }
        catch (error) {
            if (batchGenerationSequenceRef.current !== sequence) {
                return;
            }
            dispatch({
                type: "BATCH_GENERATION_FAILED",
                batchId,
                error: error instanceof SubPdfGenerationError
                    ? error.message
                    : error instanceof Error
                        ? error.message
                        : "La génération locale du sous-PDF a échoué."
            });
        }
    }, [state.batching.activeBatchId, state.batching.plan, state.pdf]);
    const generateAllPlannedBatches = useCallback(async () => {
        const pdf = state.pdf;
        const plan = state.batching.plan;
        if (pdf === null || plan === null || state.batching.activeBatchId !== null) {
            return;
        }
        const sequence = batchGenerationSequenceRef.current + 1;
        batchGenerationSequenceRef.current = sequence;
        for (const batch of plan.batches) {
            if (batchGenerationSequenceRef.current !== sequence) {
                return;
            }
            dispatch({ type: "BATCH_GENERATION_STARTED", batchId: batch.id });
            try {
                const artifact = await createSubPdf(pdf.bytes, pdf.fileName, batch);
                if (batchGenerationSequenceRef.current !== sequence) {
                    return;
                }
                dispatch({ type: "BATCH_GENERATED", artifact });
            }
            catch (error) {
                if (batchGenerationSequenceRef.current !== sequence) {
                    return;
                }
                dispatch({
                    type: "BATCH_GENERATION_FAILED",
                    batchId: batch.id,
                    error: error instanceof SubPdfGenerationError
                        ? error.message
                        : error instanceof Error
                            ? error.message
                            : "La génération locale du sous-PDF a échoué."
                });
            }
        }
    }, [state.batching.activeBatchId, state.batching.plan, state.pdf]);
    const downloadBatch = useCallback((batchId) => {
        const artifact = state.batching.artifacts[batchId];
        if (artifact === undefined) {
            return;
        }
        const downloadableBytes = new Uint8Array(artifact.bytes.byteLength);
        downloadableBytes.set(artifact.bytes);
        const blob = new Blob([downloadableBytes.buffer], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = artifact.fileName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, [state.batching.artifacts]);
    const clearBatches = useCallback(() => {
        batchGenerationSequenceRef.current += 1;
        dispatch({ type: "BATCHES_CLEARED" });
    }, []);
    const updateExtractionSettings = useCallback((settings) => {
        dispatch({ type: "EXTRACTION_SETTINGS_UPDATED", settings });
    }, []);
    const prepareArtifact = useCallback(async (batchId, sequence) => {
        const pdf = state.pdf;
        const batch = state.batching.plan?.batches.find((candidate) => candidate.id === batchId);
        if (pdf === null || batch === undefined) {
            throw new Error("Le lot demandé n’existe plus.");
        }
        const existing = state.batching.artifacts[batchId];
        if (existing !== undefined) {
            return existing;
        }
        dispatch({ type: "BATCH_GENERATION_STARTED", batchId });
        try {
            const artifact = await createSubPdf(pdf.bytes, pdf.fileName, batch);
            if (extractionRunSequenceRef.current !== sequence) {
                throw new DOMException("Extraction annulée", "AbortError");
            }
            dispatch({ type: "BATCH_GENERATED", artifact });
            return artifact;
        }
        catch (error) {
            const message = error instanceof SubPdfGenerationError
                ? error.message
                : error instanceof Error
                    ? error.message
                    : "La génération locale du sous-PDF a échoué.";
            dispatch({ type: "BATCH_GENERATION_FAILED", batchId, error: message });
            throw error;
        }
    }, [state.batching.artifacts, state.batching.plan, state.pdf]);
    const extractBatchWithRetries = useCallback(async (batchId, sequence, artifactOverride) => {
        const pdf = state.pdf;
        const documentMap = state.mapping.data;
        const batch = state.batching.plan?.batches.find((candidate) => candidate.id === batchId);
        if (pdf === null || documentMap === null || batch === undefined) {
            return false;
        }
        let artifact = artifactOverride;
        if (artifact === undefined) {
            try {
                artifact = await prepareArtifact(batchId, sequence);
            }
            catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    dispatch({ type: "EXTRACTION_BATCH_CANCELLED", batchId });
                    return false;
                }
                dispatch({
                    type: "EXTRACTION_BATCH_FAILED",
                    batchId,
                    attempt: 0,
                    error: toExtractionError(error)
                });
                return false;
            }
        }
        const maximumAttempts = 1 + state.extraction.settings.maxRetries;
        for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
            if (extractionRunSequenceRef.current !== sequence) {
                dispatch({ type: "EXTRACTION_BATCH_CANCELLED", batchId });
                return false;
            }
            dispatch({ type: "EXTRACTION_BATCH_PREPARING", batchId, attempt });
            const controller = new AbortController();
            extractionControllersRef.current.set(batchId, controller);
            try {
                const response = await extractQuestions(artifactArrayBuffer(artifact.bytes), artifact.fileName, createExtractionContext(batch, documentMap), controller.signal, (progress) => {
                    if (extractionRunSequenceRef.current === sequence) {
                        dispatch({ type: "EXTRACTION_BATCH_PROGRESS", batchId, progress });
                    }
                });
                const validated = validateAndNormalizeExtractionResult(response.data, batch);
                if (extractionRunSequenceRef.current !== sequence) {
                    return false;
                }
                dispatch({
                    type: "EXTRACTION_BATCH_SUCCEEDED",
                    batchId,
                    result: validated.result,
                    meta: response.meta,
                    completedAt: Date.now()
                });
                return true;
            }
            catch (error) {
                if (error instanceof DOMException && error.name === "AbortError") {
                    dispatch({ type: "EXTRACTION_BATCH_CANCELLED", batchId });
                    return false;
                }
                const normalized = toExtractionError(error);
                if (normalized.retryable && attempt < maximumAttempts) {
                    await delay(900 * attempt);
                    continue;
                }
                dispatch({
                    type: "EXTRACTION_BATCH_FAILED",
                    batchId,
                    attempt,
                    error: normalized
                });
                return false;
            }
            finally {
                if (extractionControllersRef.current.get(batchId) === controller) {
                    extractionControllersRef.current.delete(batchId);
                }
            }
        }
        return false;
    }, [prepareArtifact, state.batching.plan, state.extraction.settings.maxRetries, state.mapping.data, state.pdf]);
    const extractAllBatches = useCallback(async () => {
        const plan = state.batching.plan;
        if (plan === null || state.extraction.runStatus === "running") {
            return;
        }
        const sequence = extractionRunSequenceRef.current + 1;
        extractionRunSequenceRef.current = sequence;
        dispatch({ type: "EXTRACTION_RUN_STARTED", startedAt: Date.now() });
        const artifacts = new Map(Object.entries(state.batching.artifacts));
        for (const batch of plan.batches) {
            if (extractionRunSequenceRef.current !== sequence)
                return;
            if (artifacts.has(batch.id))
                continue;
            try {
                artifacts.set(batch.id, await prepareArtifact(batch.id, sequence));
            }
            catch (error) {
                if (error instanceof DOMException && error.name === "AbortError")
                    return;
                dispatch({
                    type: "EXTRACTION_BATCH_FAILED",
                    batchId: batch.id,
                    attempt: 0,
                    error: toExtractionError(error)
                });
            }
        }
        const pending = plan.batches.filter((batch) => state.extraction.batches[batch.id]?.status !== "completed" && artifacts.has(batch.id));
        let nextIndex = 0;
        const worker = async () => {
            while (extractionRunSequenceRef.current === sequence) {
                const batch = pending[nextIndex];
                nextIndex += 1;
                if (batch === undefined)
                    return;
                await extractBatchWithRetries(batch.id, sequence, artifacts.get(batch.id));
            }
        };
        await Promise.all(Array.from({ length: Math.min(state.extraction.settings.maxConcurrentBatches, pending.length) }, () => worker()));
        if (extractionRunSequenceRef.current === sequence) {
            dispatch({ type: "EXTRACTION_RUN_FINISHED" });
        }
    }, [extractBatchWithRetries, prepareArtifact, state.batching.artifacts, state.batching.plan, state.extraction.batches, state.extraction.runStatus, state.extraction.settings.maxConcurrentBatches]);
    const extractSingleBatch = useCallback(async (batchId) => {
        if (state.extraction.runStatus === "running")
            return;
        const sequence = extractionRunSequenceRef.current + 1;
        extractionRunSequenceRef.current = sequence;
        dispatch({ type: "EXTRACTION_RUN_STARTED", startedAt: Date.now() });
        await extractBatchWithRetries(batchId, sequence);
        if (extractionRunSequenceRef.current === sequence) {
            dispatch({ type: "EXTRACTION_RUN_FINISHED" });
        }
    }, [extractBatchWithRetries, state.extraction.runStatus]);
    const cancelExtraction = useCallback(() => {
        extractionRunSequenceRef.current += 1;
        const activeIds = [...extractionControllersRef.current.keys()];
        extractionControllersRef.current.forEach((controller) => controller.abort());
        extractionControllersRef.current.clear();
        activeIds.forEach((batchId) => dispatch({ type: "EXTRACTION_BATCH_CANCELLED", batchId }));
        dispatch({ type: "EXTRACTION_RUN_CANCELLED" });
    }, []);
    const clearExtraction = useCallback(() => {
        extractionRunSequenceRef.current += 1;
        extractionControllersRef.current.forEach((controller) => controller.abort());
        extractionControllersRef.current.clear();
        dispatch({ type: "EXTRACTION_CLEARED" });
    }, []);
    const zoomIn = useCallback(() => {
        dispatch({ type: "SET_ZOOM", zoom: state.zoom + ZOOM_STEP });
    }, [state.zoom]);
    const zoomOut = useCallback(() => {
        dispatch({ type: "SET_ZOOM", zoom: state.zoom - ZOOM_STEP });
    }, [state.zoom]);
    const resetZoom = useCallback(() => {
        dispatch({ type: "SET_ZOOM", zoom: 1 });
    }, []);
    const previousPage = useCallback(() => {
        setPage(state.currentPage - 1);
    }, [setPage, state.currentPage]);
    const nextPage = useCallback(() => {
        setPage(state.currentPage + 1);
    }, [setPage, state.currentPage]);
    useKeyboardNavigation({
        enabled: state.status === "pdf_loaded",
        onPreviousPage: previousPage,
        onNextPage: nextPage,
        onZoomIn: zoomIn,
        onZoomOut: zoomOut,
        onResetZoom: resetZoom
    });
    return (_jsxs("div", { className: "app-shell", children: [state.status === "empty" && _jsx(FileDropZone, { onFileSelected: handleFileSelected }), state.status === "loading" && _jsx(LoadingPanel, {}), state.status === "error" && state.error !== null && (_jsx(ErrorPanel, { error: state.error, onRetry: closeDocument })), state.status === "pdf_loaded" && state.pdf !== null && (_jsx(PdfViewer, { batching: state.batching, currentPage: state.currentPage, extraction: state.extraction, mapping: state.mapping, onAnalyze: () => void analyzeMapping(), onCancelMapping: cancelMapping, onClearBatches: clearBatches, onClose: closeDocument, onDownloadBatch: downloadBatch, onExtractAll: () => void extractAllBatches(), onExtractBatch: (batchId) => void extractSingleBatch(batchId), onCancelExtraction: cancelExtraction, onClearExtraction: clearExtraction, onGenerateAllBatches: () => void generateAllPlannedBatches(), onGenerateBatch: (batchId) => void generatePlannedBatch(batchId), onAddRegion: addRegion, onDeleteRegion: deleteRegion, onPageChange: setPage, onPlanBatches: planBatches, onResetZoom: resetZoom, onSelectRegion: selectRegion, onSelectSegment: selectSegment, onUpdateRegionBbox: updateRegionBbox, onUpdateBatchSettings: updateBatchSettings, onUpdateExtractionSettings: updateExtractionSettings, onUpdateRegionRole: updateRegionRole, onZoomIn: zoomIn, onZoomOut: zoomOut, pdf: state.pdf, zoom: state.zoom }))] }));
}
