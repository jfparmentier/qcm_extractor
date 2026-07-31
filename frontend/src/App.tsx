import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  INITIAL_PROJECT_STATE,
  ZOOM_STEP,
  projectReducer
} from "./domain/projectState";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { isProjectError, loadPdfFromFile } from "./pdf/loadPdf";
import { ErrorPanel } from "./components/ErrorPanel";
import { FileDropZone } from "./components/FileDropZone";
import { LoadingPanel } from "./components/LoadingPanel";
import { PdfViewer } from "./components/PdfViewer";
import "./styles/app.css";

export default function App(): React.ReactElement {
  const [state, dispatch] = useReducer(projectReducer, INITIAL_PROJECT_STATE);
  const activeDocumentRef = useRef(state.pdf?.document ?? null);
  const loadSequenceRef = useRef(0);

  useEffect(() => {
    activeDocumentRef.current = state.pdf?.document ?? null;
  }, [state.pdf]);

  useEffect(() => {
    return () => {
      void activeDocumentRef.current?.loadingTask.destroy();
    };
  }, []);

  const closeDocument = useCallback((): void => {
    loadSequenceRef.current += 1;
    const document = activeDocumentRef.current;
    activeDocumentRef.current = null;
    dispatch({ type: "RESET" });
    void document?.loadingTask.destroy();
  }, []);

  const handleFileSelected = useCallback(async (file: File): Promise<void> => {
    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;

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
    } catch (error: unknown) {
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

  const setPage = useCallback((page: number): void => {
    dispatch({ type: "SET_PAGE", page });
  }, []);

  const zoomIn = useCallback((): void => {
    dispatch({ type: "SET_ZOOM", zoom: state.zoom + ZOOM_STEP });
  }, [state.zoom]);

  const zoomOut = useCallback((): void => {
    dispatch({ type: "SET_ZOOM", zoom: state.zoom - ZOOM_STEP });
  }, [state.zoom]);

  const resetZoom = useCallback((): void => {
    dispatch({ type: "SET_ZOOM", zoom: 1 });
  }, []);

  const previousPage = useCallback((): void => {
    setPage(state.currentPage - 1);
  }, [setPage, state.currentPage]);

  const nextPage = useCallback((): void => {
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

  return (
    <div className="app-shell">
      {state.status === "empty" && <FileDropZone onFileSelected={handleFileSelected} />}
      {state.status === "loading" && <LoadingPanel />}
      {state.status === "error" && state.error !== null && (
        <ErrorPanel error={state.error} onRetry={closeDocument} />
      )}
      {state.status === "pdf_loaded" && state.pdf !== null && (
        <PdfViewer
          currentPage={state.currentPage}
          onClose={closeDocument}
          onPageChange={setPage}
          onResetZoom={resetZoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          pdf={state.pdf}
          zoom={state.zoom}
        />
      )}
    </div>
  );
}
