import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { INITIAL_PROJECT_STATE, ZOOM_STEP, projectReducer } from "./domain/projectState.js?v=7.6.1";
import { DocumentMapValidationError, createUserRegionId, validateAndNormalizeDocumentMap } from "./domain/documentMap.js?v=7.6.1";
import { createManualDocumentMap, createUserQuestionSegment } from "./domain/manualMapping.js?v=7.6.1";
import { analyzeDocumentMap, authenticateEmail, extractQuestions, loadEmailAccess, loadWorkflowConfig, ProxyApiError } from "./api/proxyClient.js?v=7.6.1";
import { createBatchPlan } from "./domain/batchPlan.js?v=7.6.1";
import { createSubPdf, SubPdfGenerationError } from "./pdf/createSubPdf.js?v=7.6.1";
import { createExtractionContext } from "./domain/extractionContext.js?v=7.6.1";
import { ExtractionValidationError, mergeExtractionResults, validateAndNormalizeExtractionResult } from "./domain/extraction.js?v=7.6.1";
import { createIllustrationPlan, INITIAL_ILLUSTRATION_GENERATION_STATE, revokeIllustrationAssets } from "./domain/illustration.js?v=7.6.1";
import { createIllustrationAssetFromUpload, generateIllustrationAssets, IllustrationGenerationError } from "./pdf/extractIllustrations.js?v=7.6.1";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation.js?v=7.6.1";
import { isProjectError, loadPdfFromFile } from "./pdf/loadPdf.js?v=7.6.1";
import { ErrorPanel } from "./components/ErrorPanel.js?v=7.6.1";
import { FileDropZone } from "./components/FileDropZone.js?v=7.6.1";
import { LoadingPanel } from "./components/LoadingPanel.js?v=7.6.1";
import { LoginPage } from "./components/LoginPage.js?v=7.6.1";
import { PdfViewer } from "./components/PdfViewer.js?v=7.6.1";

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
const EMPTY_ILLUSTRATION_PLAN = {
    candidates: [],
    segmentCount: 0,
    questionCount: 0,
    warnings: [],
    fingerprint: ""
};
function illustrationErrorMessage(error) {
    if (error instanceof IllustrationGenerationError)
        return error.message;
    if (error instanceof Error)
        return error.message;
    return "La génération locale de l’illustration a échoué.";
}
function QcmWorkspace() {
    const [state, dispatch] = useReducer(projectReducer, INITIAL_PROJECT_STATE);
    const activeDocumentRef = useRef(state.pdf?.document ?? null);
    const loadSequenceRef = useRef(0);
    const mappingAbortRef = useRef(null);
    const batchGenerationSequenceRef = useRef(0);
    const extractionRunSequenceRef = useRef(0);
    const extractionControllersRef = useRef(new Map());
    const illustrationAbortRef = useRef(null);
    const illustrationAssetsRef = useRef({});
    const illustrationFingerprintRef = useRef("");
    const workflowConfigPromiseRef = useRef(null);
    const [illustrationGeneration, setIllustrationGeneration] = useState(INITIAL_ILLUSTRATION_GENERATION_STATE);
    const ensureWorkflowConfig = useCallback(async () => {
        if (workflowConfigPromiseRef.current === null) {
            workflowConfigPromiseRef.current = loadWorkflowConfig().catch((error) => {
                workflowConfigPromiseRef.current = null;
                throw error;
            });
        }
        return workflowConfigPromiseRef.current;
    }, []);
    const completedExtractions = useMemo(() => Object.entries(state.extraction.batches).flatMap(([batchId, batchState]) => batchState.status === "completed" && batchState.result !== null && batchState.meta !== null
        ? [{ batchId, result: batchState.result, meta: batchState.meta }]
        : []), [state.extraction.batches]);
    const mergedExtraction = useMemo(() => state.mapping.data === null
        ? null
        : mergeExtractionResults(state.mapping.data, completedExtractions), [completedExtractions, state.mapping.data]);
    const illustrationPlan = useMemo(() => state.mapping.data === null || mergedExtraction === null
        ? EMPTY_ILLUSTRATION_PLAN
        : createIllustrationPlan(state.mapping.data, mergedExtraction.questions), [mergedExtraction, state.mapping.data]);
    useEffect(() => {
        activeDocumentRef.current = state.pdf?.document ?? null;
    }, [state.pdf]);
    useEffect(() => {
        illustrationAssetsRef.current = illustrationGeneration.assets;
    }, [illustrationGeneration.assets]);
    const resetIllustrations = useCallback(() => {
        illustrationAbortRef.current?.abort();
        illustrationAbortRef.current = null;
        revokeIllustrationAssets(illustrationAssetsRef.current);
        illustrationAssetsRef.current = {};
        setIllustrationGeneration(INITIAL_ILLUSTRATION_GENERATION_STATE);
    }, []);
    useEffect(() => {
        if (illustrationFingerprintRef.current === illustrationPlan.fingerprint)
            return;
        illustrationFingerprintRef.current = illustrationPlan.fingerprint;
        resetIllustrations();
    }, [illustrationPlan.fingerprint, resetIllustrations]);
    useEffect(() => {
        return () => {
            mappingAbortRef.current?.abort();
            extractionRunSequenceRef.current += 1;
            extractionControllersRef.current.forEach((controller) => controller.abort());
            extractionControllersRef.current.clear();
            illustrationAbortRef.current?.abort();
            revokeIllustrationAssets(illustrationAssetsRef.current);
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
        resetIllustrations();
        const document = activeDocumentRef.current;
        activeDocumentRef.current = null;
        dispatch({ type: "RESET" });
        void document?.loadingTask.destroy();
    }, [resetIllustrations]);
    const handleFileSelected = useCallback(async (file) => {
        const sequence = loadSequenceRef.current + 1;
        loadSequenceRef.current = sequence;
        mappingAbortRef.current?.abort();
        mappingAbortRef.current = null;
        batchGenerationSequenceRef.current += 1;
        extractionRunSequenceRef.current += 1;
        extractionControllersRef.current.forEach((controller) => controller.abort());
        extractionControllersRef.current.clear();
        resetIllustrations();
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
    }, [resetIllustrations]);
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
    const startManualMapping = useCallback(() => {
        const pdf = state.pdf;
        if (pdf === null || state.mapping.status === "running")
            return;
        const title = pdf.title?.trim() || pdf.fileName.replace(/\.pdf$/i, "");
        dispatch({
            type: "MANUAL_MAPPING_STARTED",
            documentMap: createManualDocumentMap(title, pdf.pageCount)
        });
    }, [state.mapping.status, state.pdf]);
    const addQuestion = useCallback(() => {
        const documentMap = state.mapping.data;
        if (documentMap === null)
            return;
        dispatch({
            type: "ADD_SEGMENT",
            segment: createUserQuestionSegment(state.currentPage)
        });
    }, [state.currentPage, state.mapping.data]);
    const setPage = useCallback((page) => {
        dispatch({ type: "SET_PAGE", page });
    }, []);
    const selectSegment = useCallback((segmentId) => {
        dispatch({ type: "SELECT_SEGMENT", segmentId });
    }, []);
    const deleteSegment = useCallback((segmentId) => {
        dispatch({ type: "DELETE_SEGMENT", segmentId });
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
    const prepareValidatedMapping = useCallback(async () => {
        const pdf = state.pdf;
        const documentMap = state.mapping.data;
        if (pdf === null || documentMap === null) {
            throw new Error("La cartographie du document n’est pas disponible.");
        }
        const configuration = await ensureWorkflowConfig();
        dispatch({ type: "BATCH_SETTINGS_UPDATED", settings: configuration.batch });
        dispatch({ type: "EXTRACTION_SETTINGS_UPDATED", settings: configuration.extraction });
        const plan = createBatchPlan(documentMap, pdf.fileSize, pdf.pageCount, configuration.batch);
        if (plan.batches.length === 0) {
            throw new Error("Aucun lot n’a pu être constitué à partir des zones validées.");
        }
        dispatch({ type: "BATCHES_PLANNED", plan });
        const sequence = batchGenerationSequenceRef.current + 1;
        batchGenerationSequenceRef.current = sequence;
        for (const batch of plan.batches) {
            if (batchGenerationSequenceRef.current !== sequence) {
                throw new DOMException("Préparation annulée", "AbortError");
            }
            dispatch({ type: "BATCH_GENERATION_STARTED", batchId: batch.id });
            try {
                const artifact = await createSubPdf(pdf.bytes, pdf.fileName, batch);
                if (batchGenerationSequenceRef.current !== sequence) {
                    throw new DOMException("Préparation annulée", "AbortError");
                }
                dispatch({ type: "BATCH_GENERATED", artifact });
            }
            catch (error) {
                const message = error instanceof SubPdfGenerationError
                    ? error.message
                    : error instanceof Error
                        ? error.message
                        : "La génération locale du sous-PDF a échoué.";
                dispatch({ type: "BATCH_GENERATION_FAILED", batchId: batch.id, error: message });
                throw new Error(`Le lot ${batch.sequence} n’a pas pu être préparé : ${message}`);
            }
        }
    }, [ensureWorkflowConfig, state.mapping.data, state.pdf]);
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
    const cancelExtraction = useCallback(() => {
        extractionRunSequenceRef.current += 1;
        const activeIds = [...extractionControllersRef.current.keys()];
        extractionControllersRef.current.forEach((controller) => controller.abort());
        extractionControllersRef.current.clear();
        activeIds.forEach((batchId) => dispatch({ type: "EXTRACTION_BATCH_CANCELLED", batchId }));
        dispatch({ type: "EXTRACTION_RUN_CANCELLED" });
    }, []);
    const runIllustrationGeneration = useCallback(async (candidates) => {
        const pdf = state.pdf;
        if (pdf === null || candidates.length === 0 || illustrationAbortRef.current !== null)
            return;
        const controller = new AbortController();
        illustrationAbortRef.current = controller;
        const targetIds = new Set(candidates.map((candidate) => candidate.id));
        setIllustrationGeneration((previous) => ({
            ...previous,
            status: "running",
            errors: Object.fromEntries(Object.entries(previous.errors).filter(([candidateId]) => !targetIds.has(candidateId))),
            progress: {
                completed: 0,
                total: candidates.length,
                currentPage: null,
                currentCandidateId: null
            },
            startedAt: Date.now()
        }));
        try {
            const generated = await generateIllustrationAssets(pdf.document, candidates, controller.signal, (progress) => setIllustrationGeneration((previous) => ({ ...previous, progress })));
            if (illustrationAbortRef.current !== controller) {
                generated.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
                return;
            }
            const nextAssets = {
                ...illustrationAssetsRef.current
            };
            generated.forEach((asset) => {
                const previous = nextAssets[asset.id];
                if (previous !== undefined)
                    URL.revokeObjectURL(previous.previewUrl);
                nextAssets[asset.id] = asset;
            });
            illustrationAssetsRef.current = nextAssets;
            illustrationAbortRef.current = null;
            setIllustrationGeneration((previous) => ({
                ...previous,
                status: "completed",
                assets: nextAssets,
                progress: null,
                startedAt: null
            }));
        }
        catch (error) {
            if (illustrationAbortRef.current !== controller)
                return;
            illustrationAbortRef.current = null;
            if (error instanceof DOMException && error.name === "AbortError") {
                setIllustrationGeneration((previous) => ({
                    ...previous,
                    status: "cancelled",
                    progress: null,
                    startedAt: null
                }));
                return;
            }
            const failedId = error instanceof IllustrationGenerationError
                ? error.candidateId
                : null;
            const message = illustrationErrorMessage(error);
            const failedIds = failedId === null ? candidates.map((candidate) => candidate.id) : [failedId];
            setIllustrationGeneration((previous) => ({
                ...previous,
                status: "failed",
                errors: {
                    ...previous.errors,
                    ...Object.fromEntries(failedIds.map((candidateId) => [candidateId, message]))
                },
                progress: null,
                startedAt: null
            }));
        }
    }, [state.pdf]);
    const generateAllIllustrations = useCallback(() => {
        void runIllustrationGeneration(illustrationPlan.candidates);
    }, [illustrationPlan.candidates, runIllustrationGeneration]);
    const generateOneIllustration = useCallback((candidateId) => {
        const candidate = illustrationPlan.candidates.find((entry) => entry.id === candidateId);
        if (candidate !== undefined)
            void runIllustrationGeneration([candidate]);
    }, [illustrationPlan.candidates, runIllustrationGeneration]);
    const cancelIllustrationGeneration = useCallback(() => {
        illustrationAbortRef.current?.abort();
        illustrationAbortRef.current = null;
        setIllustrationGeneration((previous) => ({
            ...previous,
            status: "cancelled",
            progress: null,
            startedAt: null
        }));
    }, []);
    const downloadIllustration = useCallback((candidateId) => {
        const asset = illustrationAssetsRef.current[candidateId];
        if (asset === undefined)
            return;
        const link = document.createElement("a");
        link.href = asset.previewUrl;
        link.download = asset.fileName;
        link.click();
    }, []);
    const replaceIllustration = useCallback(async (candidateId, file) => {
        const candidate = illustrationPlan.candidates.find((entry) => entry.id === candidateId);
        if (candidate === undefined) {
            throw new Error("L’illustration à remplacer n’existe plus.");
        }
        const fingerprint = illustrationPlan.fingerprint;
        const asset = await createIllustrationAssetFromUpload(candidate, file);
        if (illustrationFingerprintRef.current !== fingerprint) {
            URL.revokeObjectURL(asset.previewUrl);
            return;
        }
        const previous = illustrationAssetsRef.current[candidateId];
        const nextAssets = {
            ...illustrationAssetsRef.current,
            [candidateId]: asset
        };
        illustrationAssetsRef.current = nextAssets;
        setIllustrationGeneration((current) => {
            const nextErrors = { ...current.errors };
            delete nextErrors[candidateId];
            return {
                ...current,
                status: "completed",
                assets: nextAssets,
                errors: nextErrors
            };
        });
        if (previous !== undefined)
            URL.revokeObjectURL(previous.previewUrl);
    }, [illustrationPlan.candidates, illustrationPlan.fingerprint]);
    const zoomIn = useCallback(() => {
        dispatch({ type: "SET_ZOOM", zoom: state.zoom + ZOOM_STEP });
    }, [state.zoom]);
    const zoomOut = useCallback(() => {
        dispatch({ type: "SET_ZOOM", zoom: state.zoom - ZOOM_STEP });
    }, [state.zoom]);
    const resetZoom = useCallback(() => {
        dispatch({ type: "SET_ZOOM", zoom: 1 });
    }, []);
    const setZoom = useCallback((zoom) => {
        dispatch({ type: "SET_ZOOM", zoom });
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
    return (_jsxs("div", { className: "app-shell", children: [state.status === "empty" && _jsx(FileDropZone, { onFileSelected: handleFileSelected }), state.status === "loading" && _jsx(LoadingPanel, {}), state.status === "error" && state.error !== null && (_jsx(ErrorPanel, { error: state.error, onRetry: closeDocument })), state.status === "pdf_loaded" && state.pdf !== null && (_jsx(PdfViewer, { batching: state.batching, currentPage: state.currentPage, extraction: state.extraction, illustrationGeneration: illustrationGeneration, illustrationPlan: illustrationPlan, mapping: state.mapping, onAnalyze: () => void analyzeMapping(), onStartManualMapping: startManualMapping, onAddSegment: addQuestion, onCancelMapping: cancelMapping, onValidateMapping: prepareValidatedMapping, onClose: closeDocument, onExtractAll: () => void extractAllBatches(), onCancelExtraction: cancelExtraction, onGenerateAllIllustrations: generateAllIllustrations, onGenerateIllustration: generateOneIllustration, onCancelIllustrationGeneration: cancelIllustrationGeneration, onClearIllustrations: resetIllustrations, onDownloadIllustration: downloadIllustration, onReplaceIllustration: replaceIllustration, onAddRegion: addRegion, onDeleteRegion: deleteRegion, onDeleteSegment: deleteSegment, onPageChange: setPage, onResetZoom: resetZoom, onSelectRegion: selectRegion, onSelectSegment: selectSegment, onUpdateRegionBbox: updateRegionBbox, onUpdateRegionRole: updateRegionRole, onZoomIn: zoomIn, onZoomOut: zoomOut, onZoomChange: setZoom, pdf: state.pdf, zoom: state.zoom }))] }));
}
export default function App() {
    const [accessState, setAccessState] = useState("checking");
    const [authenticating, setAuthenticating] = useState(false);
    const [accessError, setAccessError] = useState(null);
    useEffect(() => {
        const controller = new AbortController();
        void loadEmailAccess(controller.signal)
            .then((access) => {
            setAccessState(access.authenticated ? "authenticated" : "anonymous");
            setAccessError(null);
        })
            .catch((error) => {
            if (error instanceof DOMException && error.name === "AbortError")
                return;
            setAccessState("anonymous");
            setAccessError(error instanceof Error ? error.message : "Le serveur de connexion est inaccessible.");
        });
        return () => controller.abort();
    }, []);
    const handleAuthenticate = useCallback(async (email) => {
        setAuthenticating(true);
        setAccessError(null);
        try {
            const access = await authenticateEmail(email.trim());
            if (!access.authenticated) {
                throw new Error("Cette adresse email n’est pas autorisée.");
            }
            setAccessState("authenticated");
        }
        catch (error) {
            setAccessError(error instanceof Error ? error.message : "La vérification de l’adresse email a échoué.");
        }
        finally {
            setAuthenticating(false);
        }
    }, []);
    if (accessState !== "authenticated") {
        return (_jsx(LoginPage, { checking: accessState === "checking", error: accessError, onSubmit: (email) => void handleAuthenticate(email), submitting: authenticating }));
    }
    return _jsx(QcmWorkspace, {});
}
