import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { INITIAL_PROJECT_STATE, ZOOM_STEP, projectReducer } from "./domain/projectState.js";
import { DocumentMapValidationError, validateAndNormalizeDocumentMap } from "./domain/documentMap.js";
import { analyzeDocumentMap, ProxyApiError } from "./api/proxyClient.js";
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
export default function App() {
    const [state, dispatch] = useReducer(projectReducer, INITIAL_PROJECT_STATE);
    const activeDocumentRef = useRef(state.pdf?.document ?? null);
    const loadSequenceRef = useRef(0);
    const mappingAbortRef = useRef(null);
    useEffect(() => {
        activeDocumentRef.current = state.pdf?.document ?? null;
    }, [state.pdf]);
    useEffect(() => {
        return () => {
            mappingAbortRef.current?.abort();
            void activeDocumentRef.current?.loadingTask.destroy();
        };
    }, []);
    const closeDocument = useCallback(() => {
        loadSequenceRef.current += 1;
        mappingAbortRef.current?.abort();
        mappingAbortRef.current = null;
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
            const response = await analyzeDocumentMap(pdf.bytes, pdf.fileName, controller.signal);
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
    return (_jsxs("div", { className: "app-shell", children: [state.status === "empty" && _jsx(FileDropZone, { onFileSelected: handleFileSelected }), state.status === "loading" && _jsx(LoadingPanel, {}), state.status === "error" && state.error !== null && (_jsx(ErrorPanel, { error: state.error, onRetry: closeDocument })), state.status === "pdf_loaded" && state.pdf !== null && (_jsx(PdfViewer, { currentPage: state.currentPage, mapping: state.mapping, onAnalyze: () => void analyzeMapping(), onCancelMapping: cancelMapping, onClose: closeDocument, onPageChange: setPage, onResetZoom: resetZoom, onSelectSegment: selectSegment, onZoomIn: zoomIn, onZoomOut: zoomOut, pdf: state.pdf, zoom: state.zoom }))] }));
}
