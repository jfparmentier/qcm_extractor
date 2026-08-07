import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  INITIAL_PROJECT_STATE,
  ZOOM_STEP,
  projectReducer,
  type ExtractionBatchError,
  type MappingError
} from "./domain/projectState";
import {
  DocumentMapValidationError,
  createUserRegionId,
  validateAndNormalizeDocumentMap,
  type NormalizedBoundingBox,
  type PageRegionRole
} from "./domain/documentMap";
import {
  createManualDocumentMap,
  createUserQuestionSegment
} from "./domain/manualMapping";
import {
  analyzeDocumentMap,
  extractQuestions,
  loadWorkflowConfig,
  ProxyApiError,
  type WorkflowConfig
} from "./api/proxyClient";
import { createBatchPlan } from "./domain/batchPlan";
import { createSubPdf, SubPdfGenerationError } from "./pdf/createSubPdf";
import { createExtractionContext } from "./domain/extractionContext";
import {
  ExtractionValidationError,
  mergeExtractionResults,
  validateAndNormalizeExtractionResult,
  type CompletedBatchExtraction
} from "./domain/extraction";
import {
  createIllustrationPlan,
  INITIAL_ILLUSTRATION_GENERATION_STATE,
  revokeIllustrationAssets,
  type GeneratedIllustrationAsset,
  type IllustrationGenerationState,
  type IllustrationPlan
} from "./domain/illustration";
import {
  createIllustrationAssetFromUpload,
  generateIllustrationAssets,
  IllustrationGenerationError
} from "./pdf/extractIllustrations";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { isProjectError, loadPdfFromFile } from "./pdf/loadPdf";
import { ErrorPanel } from "./components/ErrorPanel";
import { FileDropZone } from "./components/FileDropZone";
import { LoadingPanel } from "./components/LoadingPanel";
import { PdfViewer } from "./components/PdfViewer";
import "./styles/app.css";

function toMappingError(error: unknown): MappingError {
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

function toExtractionError(error: unknown): ExtractionBatchError {
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

function artifactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

const EMPTY_ILLUSTRATION_PLAN: IllustrationPlan = {
  candidates: [],
  segmentCount: 0,
  questionCount: 0,
  warnings: [],
  fingerprint: ""
};

function illustrationErrorMessage(error: unknown): string {
  if (error instanceof IllustrationGenerationError) return error.message;
  if (error instanceof Error) return error.message;
  return "La génération locale de l’illustration a échoué.";
}

export default function App(): React.ReactElement {
  const [state, dispatch] = useReducer(projectReducer, INITIAL_PROJECT_STATE);
  const activeDocumentRef = useRef(state.pdf?.document ?? null);
  const loadSequenceRef = useRef(0);
  const mappingAbortRef = useRef<AbortController | null>(null);
  const batchGenerationSequenceRef = useRef(0);
  const extractionRunSequenceRef = useRef(0);
  const extractionControllersRef = useRef(new Map<string, AbortController>());
  const illustrationAbortRef = useRef<AbortController | null>(null);
  const illustrationAssetsRef = useRef<Readonly<Record<string, GeneratedIllustrationAsset>>>({});
  const illustrationFingerprintRef = useRef("");
  const workflowConfigPromiseRef = useRef<Promise<WorkflowConfig> | null>(null);
  const [illustrationGeneration, setIllustrationGeneration] = useState<IllustrationGenerationState>(
    INITIAL_ILLUSTRATION_GENERATION_STATE
  );


  const ensureWorkflowConfig = useCallback(async (): Promise<WorkflowConfig> => {
    if (workflowConfigPromiseRef.current === null) {
      workflowConfigPromiseRef.current = loadWorkflowConfig().catch((error: unknown) => {
        workflowConfigPromiseRef.current = null;
        throw error;
      });
    }
    return workflowConfigPromiseRef.current;
  }, []);

  const completedExtractions = useMemo<CompletedBatchExtraction[]>(() =>
    Object.entries(state.extraction.batches).flatMap(([batchId, batchState]) =>
      batchState.status === "completed" && batchState.result !== null && batchState.meta !== null
        ? [{ batchId, result: batchState.result, meta: batchState.meta }]
        : []
    ), [state.extraction.batches]);

  const mergedExtraction = useMemo(() =>
    state.mapping.data === null
      ? null
      : mergeExtractionResults(state.mapping.data, completedExtractions),
  [completedExtractions, state.mapping.data]);

  const illustrationPlan = useMemo<IllustrationPlan>(() =>
    state.mapping.data === null || mergedExtraction === null
      ? EMPTY_ILLUSTRATION_PLAN
      : createIllustrationPlan(state.mapping.data, mergedExtraction.questions),
  [mergedExtraction, state.mapping.data]);

  useEffect(() => {
    activeDocumentRef.current = state.pdf?.document ?? null;
  }, [state.pdf]);

  useEffect(() => {
    illustrationAssetsRef.current = illustrationGeneration.assets;
  }, [illustrationGeneration.assets]);

  const resetIllustrations = useCallback((): void => {
    illustrationAbortRef.current?.abort();
    illustrationAbortRef.current = null;
    revokeIllustrationAssets(illustrationAssetsRef.current);
    illustrationAssetsRef.current = {};
    setIllustrationGeneration(INITIAL_ILLUSTRATION_GENERATION_STATE);
  }, []);

  useEffect(() => {
    if (illustrationFingerprintRef.current === illustrationPlan.fingerprint) return;
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

  const closeDocument = useCallback((): void => {
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

  const handleFileSelected = useCallback(async (file: File): Promise<void> => {
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
  }, [resetIllustrations]);

  const analyzeMapping = useCallback(async (): Promise<void> => {
    const pdf = state.pdf;
    if (pdf === null || state.mapping.status === "running") {
      return;
    }

    const controller = new AbortController();
    mappingAbortRef.current?.abort();
    mappingAbortRef.current = controller;
    dispatch({ type: "MAPPING_STARTED", startedAt: Date.now() });

    try {
      const response = await analyzeDocumentMap<unknown>(
        pdf.bytes,
        pdf.fileName,
        controller.signal,
        (progress) => {
          if (mappingAbortRef.current === controller) {
            dispatch({ type: "MAPPING_PROGRESS", progress });
          }
        }
      );
      const { documentMap } = validateAndNormalizeDocumentMap(response.data, pdf.pageCount);

      if (mappingAbortRef.current !== controller) {
        return;
      }

      mappingAbortRef.current = null;
      dispatch({ type: "MAPPING_SUCCEEDED", documentMap, meta: response.meta });
    } catch (error: unknown) {
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

  const cancelMapping = useCallback((): void => {
    mappingAbortRef.current?.abort();
    mappingAbortRef.current = null;
    dispatch({ type: "MAPPING_CANCELLED" });
  }, []);

  const startManualMapping = useCallback((): void => {
    const pdf = state.pdf;
    if (pdf === null || state.mapping.status === "running") return;

    const title = pdf.title?.trim() || pdf.fileName.replace(/\.pdf$/i, "");
    dispatch({
      type: "MANUAL_MAPPING_STARTED",
      documentMap: createManualDocumentMap(title, pdf.pageCount)
    });
  }, [state.mapping.status, state.pdf]);

  const addQuestion = useCallback((): void => {
    const documentMap = state.mapping.data;
    if (documentMap === null) return;

    dispatch({
      type: "ADD_SEGMENT",
      segment: createUserQuestionSegment(state.currentPage)
    });
  }, [state.currentPage, state.mapping.data]);

  const setPage = useCallback((page: number): void => {
    dispatch({ type: "SET_PAGE", page });
  }, []);

  const selectSegment = useCallback((segmentId: string): void => {
    dispatch({ type: "SELECT_SEGMENT", segmentId });
  }, []);

  const deleteSegment = useCallback((segmentId: string): void => {
    dispatch({ type: "DELETE_SEGMENT", segmentId });
  }, []);

  const selectRegion = useCallback((segmentId: string, regionId: string): void => {
    dispatch({ type: "SELECT_REGION", segmentId, regionId });
  }, []);

  const updateRegionBbox = useCallback((
    segmentId: string,
    regionId: string,
    bbox: NormalizedBoundingBox
  ): void => {
    dispatch({ type: "UPDATE_REGION_BBOX", segmentId, regionId, bbox });
  }, []);

  const updateRegionRole = useCallback((
    segmentId: string,
    regionId: string,
    role: PageRegionRole
  ): void => {
    dispatch({ type: "UPDATE_REGION_ROLE", segmentId, regionId, role });
  }, []);

  const addRegion = useCallback((
    segmentId: string,
    page: number,
    role: PageRegionRole,
    bbox: NormalizedBoundingBox
  ): void => {
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

  const deleteRegion = useCallback((segmentId: string, regionId: string): void => {
    dispatch({ type: "DELETE_REGION", segmentId, regionId });
  }, []);


  const prepareValidatedMapping = useCallback(async (): Promise<void> => {
    const pdf = state.pdf;
    const documentMap = state.mapping.data;
    if (pdf === null || documentMap === null) {
      throw new Error("La cartographie du document n’est pas disponible.");
    }

    const configuration = await ensureWorkflowConfig();
    dispatch({ type: "BATCH_SETTINGS_UPDATED", settings: configuration.batch });
    dispatch({ type: "EXTRACTION_SETTINGS_UPDATED", settings: configuration.extraction });

    const plan = createBatchPlan(
      documentMap,
      pdf.fileSize,
      pdf.pageCount,
      configuration.batch
    );
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
      } catch (error: unknown) {
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

  const prepareArtifact = useCallback(async (
    batchId: string,
    sequence: number
  ) => {
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
    } catch (error: unknown) {
      const message = error instanceof SubPdfGenerationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "La génération locale du sous-PDF a échoué.";
      dispatch({ type: "BATCH_GENERATION_FAILED", batchId, error: message });
      throw error;
    }
  }, [state.batching.artifacts, state.batching.plan, state.pdf]);

  const extractBatchWithRetries = useCallback(async (
    batchId: string,
    sequence: number,
    artifactOverride?: Awaited<ReturnType<typeof prepareArtifact>>
  ): Promise<boolean> => {
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
      } catch (error: unknown) {
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
        const response = await extractQuestions<unknown>(
          artifactArrayBuffer(artifact.bytes),
          artifact.fileName,
          createExtractionContext(batch, documentMap),
          controller.signal,
          (progress) => {
            if (extractionRunSequenceRef.current === sequence) {
              dispatch({ type: "EXTRACTION_BATCH_PROGRESS", batchId, progress });
            }
          }
        );
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
      } catch (error: unknown) {
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
      } finally {
        if (extractionControllersRef.current.get(batchId) === controller) {
          extractionControllersRef.current.delete(batchId);
        }
      }
    }

    return false;
  }, [prepareArtifact, state.batching.plan, state.extraction.settings.maxRetries, state.mapping.data, state.pdf]);

  const extractAllBatches = useCallback(async (): Promise<void> => {
    const plan = state.batching.plan;
    if (plan === null || state.extraction.runStatus === "running") {
      return;
    }

    const sequence = extractionRunSequenceRef.current + 1;
    extractionRunSequenceRef.current = sequence;
    dispatch({ type: "EXTRACTION_RUN_STARTED", startedAt: Date.now() });

    const artifacts = new Map(Object.entries(state.batching.artifacts));
    for (const batch of plan.batches) {
      if (extractionRunSequenceRef.current !== sequence) return;
      if (artifacts.has(batch.id)) continue;
      try {
        artifacts.set(batch.id, await prepareArtifact(batch.id, sequence));
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        dispatch({
          type: "EXTRACTION_BATCH_FAILED",
          batchId: batch.id,
          attempt: 0,
          error: toExtractionError(error)
        });
      }
    }

    const pending = plan.batches.filter(
      (batch) => state.extraction.batches[batch.id]?.status !== "completed" && artifacts.has(batch.id)
    );
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (extractionRunSequenceRef.current === sequence) {
        const batch = pending[nextIndex];
        nextIndex += 1;
        if (batch === undefined) return;
        await extractBatchWithRetries(batch.id, sequence, artifacts.get(batch.id));
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(state.extraction.settings.maxConcurrentBatches, pending.length) },
        () => worker()
      )
    );

    if (extractionRunSequenceRef.current === sequence) {
      dispatch({ type: "EXTRACTION_RUN_FINISHED" });
    }
  }, [extractBatchWithRetries, prepareArtifact, state.batching.artifacts, state.batching.plan, state.extraction.batches, state.extraction.runStatus, state.extraction.settings.maxConcurrentBatches]);

  const cancelExtraction = useCallback((): void => {
    extractionRunSequenceRef.current += 1;
    const activeIds = [...extractionControllersRef.current.keys()];
    extractionControllersRef.current.forEach((controller) => controller.abort());
    extractionControllersRef.current.clear();
    activeIds.forEach((batchId) => dispatch({ type: "EXTRACTION_BATCH_CANCELLED", batchId }));
    dispatch({ type: "EXTRACTION_RUN_CANCELLED" });
  }, []);

  const runIllustrationGeneration = useCallback(async (
    candidates: IllustrationPlan["candidates"]
  ): Promise<void> => {
    const pdf = state.pdf;
    if (pdf === null || candidates.length === 0 || illustrationAbortRef.current !== null) return;

    const controller = new AbortController();
    illustrationAbortRef.current = controller;
    const targetIds = new Set(candidates.map((candidate) => candidate.id));
    setIllustrationGeneration((previous) => ({
      ...previous,
      status: "running",
      errors: Object.fromEntries(
        Object.entries(previous.errors).filter(([candidateId]) => !targetIds.has(candidateId))
      ),
      progress: {
        completed: 0,
        total: candidates.length,
        currentPage: null,
        currentCandidateId: null
      },
      startedAt: Date.now()
    }));

    try {
      const generated = await generateIllustrationAssets(
        pdf.document,
        candidates,
        controller.signal,
        (progress) => setIllustrationGeneration((previous) => ({ ...previous, progress }))
      );
      if (illustrationAbortRef.current !== controller) {
        generated.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
        return;
      }

      const nextAssets: Record<string, GeneratedIllustrationAsset> = {
        ...illustrationAssetsRef.current
      };
      generated.forEach((asset) => {
        const previous = nextAssets[asset.id];
        if (previous !== undefined) URL.revokeObjectURL(previous.previewUrl);
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
    } catch (error: unknown) {
      if (illustrationAbortRef.current !== controller) return;
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

  const generateAllIllustrations = useCallback((): void => {
    void runIllustrationGeneration(illustrationPlan.candidates);
  }, [illustrationPlan.candidates, runIllustrationGeneration]);

  const generateOneIllustration = useCallback((candidateId: string): void => {
    const candidate = illustrationPlan.candidates.find((entry) => entry.id === candidateId);
    if (candidate !== undefined) void runIllustrationGeneration([candidate]);
  }, [illustrationPlan.candidates, runIllustrationGeneration]);

  const cancelIllustrationGeneration = useCallback((): void => {
    illustrationAbortRef.current?.abort();
    illustrationAbortRef.current = null;
    setIllustrationGeneration((previous) => ({
      ...previous,
      status: "cancelled",
      progress: null,
      startedAt: null
    }));
  }, []);

  const downloadIllustration = useCallback((candidateId: string): void => {
    const asset = illustrationAssetsRef.current[candidateId];
    if (asset === undefined) return;
    const link = document.createElement("a");
    link.href = asset.previewUrl;
    link.download = asset.fileName;
    link.click();
  }, []);

  const replaceIllustration = useCallback(async (candidateId: string, file: File): Promise<void> => {
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
    if (previous !== undefined) URL.revokeObjectURL(previous.previewUrl);
  }, [illustrationPlan.candidates, illustrationPlan.fingerprint]);

  const zoomIn = useCallback((): void => {
    dispatch({ type: "SET_ZOOM", zoom: state.zoom + ZOOM_STEP });
  }, [state.zoom]);

  const zoomOut = useCallback((): void => {
    dispatch({ type: "SET_ZOOM", zoom: state.zoom - ZOOM_STEP });
  }, [state.zoom]);

  const resetZoom = useCallback((): void => {
    dispatch({ type: "SET_ZOOM", zoom: 1 });
  }, []);

  const setZoom = useCallback((zoom: number): void => {
    dispatch({ type: "SET_ZOOM", zoom });
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
          batching={state.batching}
          currentPage={state.currentPage}
          extraction={state.extraction}
          illustrationGeneration={illustrationGeneration}
          illustrationPlan={illustrationPlan}
          mapping={state.mapping}
          onAnalyze={() => void analyzeMapping()}
          onStartManualMapping={startManualMapping}
          onAddSegment={addQuestion}
          onCancelMapping={cancelMapping}
          onValidateMapping={prepareValidatedMapping}
          onClose={closeDocument}
          onExtractAll={() => void extractAllBatches()}
          onCancelExtraction={cancelExtraction}
          onGenerateAllIllustrations={generateAllIllustrations}
          onGenerateIllustration={generateOneIllustration}
          onCancelIllustrationGeneration={cancelIllustrationGeneration}
          onClearIllustrations={resetIllustrations}
          onDownloadIllustration={downloadIllustration}
          onReplaceIllustration={replaceIllustration}
          onAddRegion={addRegion}
          onDeleteRegion={deleteRegion}
          onDeleteSegment={deleteSegment}
          onPageChange={setPage}
          onResetZoom={resetZoom}
          onSelectRegion={selectRegion}
          onSelectSegment={selectSegment}
          onUpdateRegionBbox={updateRegionBbox}
          onUpdateRegionRole={updateRegionRole}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomChange={setZoom}
          pdf={state.pdf}
          zoom={state.zoom}
        />
      )}
    </div>
  );
}
