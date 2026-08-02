import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BatchPreparationState,
  ExtractionState,
  LoadedPdf,
  MappingState
} from "../domain/projectState";
import { MAX_ZOOM } from "../domain/projectState";
import type {
  IllustrationGenerationState,
  IllustrationPlan
} from "../domain/illustration";
import {
  getSegmentDisplayName,
  type NormalizedBoundingBox,
  type PageRegionRole
} from "../domain/documentMap";
import {
  mergeExtractionResults,
  type CompletedBatchExtraction
} from "../domain/extraction";
import {
  createReviewArchive,
  createReviewExport,
  createReviewQuestions,
  downloadBlob,
  exportFileName,
  reviewSourceFingerprint,
  type ReviewQuestion
} from "../domain/review";
import { ExtractionPanel } from "./ExtractionPanel";
import { IllustrationPanel } from "./IllustrationPanel";
import { MappingPanel } from "./MappingPanel";
import { PreparationPanel } from "./PreparationPanel";
import { PdfPageCanvas, type PdfOverlayRegion } from "./PdfPageCanvas";
import { PdfToolbar } from "./PdfToolbar";
import { QuestionReview } from "./QuestionReview";

interface PdfViewerProps {
  readonly pdf: LoadedPdf;
  readonly currentPage: number;
  readonly zoom: number;
  readonly mapping: MappingState;
  readonly batching: BatchPreparationState;
  readonly extraction: ExtractionState;
  readonly illustrationPlan: IllustrationPlan;
  readonly illustrationGeneration: IllustrationGenerationState;
  readonly onAnalyze: () => void;
  readonly onCancelMapping: () => void;
  readonly onValidateMapping: () => Promise<void>;
  readonly onSelectSegment: (segmentId: string) => void;
  readonly onSelectRegion: (segmentId: string, regionId: string) => void;
  readonly onUpdateRegionBbox: (
    segmentId: string,
    regionId: string,
    bbox: NormalizedBoundingBox
  ) => void;
  readonly onUpdateRegionRole: (
    segmentId: string,
    regionId: string,
    role: PageRegionRole
  ) => void;
  readonly onAddRegion: (
    segmentId: string,
    page: number,
    role: PageRegionRole,
    bbox: NormalizedBoundingBox
  ) => void;
  readonly onDeleteRegion: (segmentId: string, regionId: string) => void;
  readonly onDeleteSegment: (segmentId: string) => void;
  readonly onExtractAll: () => void;
  readonly onCancelExtraction: () => void;
  readonly onGenerateAllIllustrations: () => void;
  readonly onGenerateIllustration: (candidateId: string) => void;
  readonly onCancelIllustrationGeneration: () => void;
  readonly onClearIllustrations: () => void;
  readonly onDownloadIllustration: (candidateId: string) => void;
  readonly onPageChange: (page: number) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onResetZoom: () => void;
  readonly onZoomChange: (zoom: number) => void;
  readonly onClose: () => void;
}

type ActivePanel = "mapping" | "preparing" | "extraction" | "illustrations" | "review";

function isEditableElement(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);
}

export function PdfViewer({
  pdf,
  currentPage,
  zoom,
  mapping,
  batching,
  extraction,
  illustrationPlan,
  illustrationGeneration,
  onAnalyze,
  onCancelMapping,
  onValidateMapping,
  onSelectSegment,
  onSelectRegion,
  onUpdateRegionBbox,
  onUpdateRegionRole,
  onAddRegion,
  onDeleteRegion,
  onDeleteSegment,
  onExtractAll,
  onCancelExtraction,
  onGenerateAllIllustrations,
  onGenerateIllustration,
  onCancelIllustrationGeneration,
  onClearIllustrations,
  onDownloadIllustration,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onZoomChange
}: PdfViewerProps): React.ReactElement {
  const [renderError, setRenderError] = useState<string | null>(null);
  const [drawingRole, setDrawingRole] = useState<PageRegionRole>("question");
  const [isDrawing, setIsDrawing] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("mapping");
  const [reviewQuestions, setReviewQuestions] = useState<readonly ReviewQuestion[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const reviewFingerprintRef = useRef("");
  const pageWorkspaceRef = useRef<HTMLElement>(null);
  const handleRenderError = useCallback((message: string) => setRenderError(message), []);
  const showSidePanel = mapping.status !== "idle" && activePanel !== "review";

  useEffect(() => {
    const workspace = pageWorkspaceRef.current;
    if (workspace === null || activePanel !== "mapping" || !showSidePanel) return;

    let disposed = false;

    const ensureMappingPageWidth = async (): Promise<void> => {
      const page = await pdf.document.getPage(currentPage);
      if (disposed) return;

      const pageWidth = page.getViewport({ scale: 1 }).width;
      const minimumZoom = Math.min(MAX_ZOOM, (workspace.clientWidth * 0.75 + 1) / pageWidth);
      if (zoom < minimumZoom) onZoomChange(minimumZoom);
    };

    const updateMinimumZoom = (): void => {
      void ensureMappingPageWidth().catch(() => undefined);
    };
    const resizeObserver = new ResizeObserver(updateMinimumZoom);
    resizeObserver.observe(workspace);
    updateMinimumZoom();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
    };
  }, [activePanel, currentPage, onZoomChange, pdf.document, showSidePanel, zoom]);

  const completedExtractions = useMemo<CompletedBatchExtraction[]>(() =>
    Object.entries(extraction.batches).flatMap(([batchId, batchState]) =>
      batchState.status === "completed" && batchState.result !== null && batchState.meta !== null
        ? [{ batchId, result: batchState.result, meta: batchState.meta }]
        : []
    ), [extraction.batches]);

  const mergedExtraction = useMemo(() =>
    mapping.data === null
      ? null
      : mergeExtractionResults(mapping.data, completedExtractions),
  [completedExtractions, mapping.data]);

  const extractedQuestions = mergedExtraction?.questions ?? [];
  const extractedFingerprint = useMemo(
    () => reviewSourceFingerprint(extractedQuestions),
    [extractedQuestions]
  );
  const illustrationsReady = useMemo(
    () => illustrationPlan.candidates.every(
      (candidate) => illustrationGeneration.assets[candidate.id] !== undefined
    ),
    [illustrationGeneration.assets, illustrationPlan.candidates]
  );
  const extractionAllCompleted = useMemo(() => {
    const plannedBatches = batching.plan?.batches ?? [];
    return plannedBatches.length > 0 && plannedBatches.every(
      (batch) => extraction.batches[batch.id]?.status === "completed"
    );
  }, [batching.plan, extraction.batches]);
  const automaticIllustrationFingerprintRef = useRef("");
  const automaticExtractionPendingRef = useRef(false);

  useEffect(() => {
    if (extractedQuestions.length === 0) {
      reviewFingerprintRef.current = "";
      automaticIllustrationFingerprintRef.current = "";
      setReviewQuestions([]);
      setReviewIndex(0);
      return;
    }

    if (!extractionAllCompleted || reviewFingerprintRef.current === extractedFingerprint) {
      return;
    }

    reviewFingerprintRef.current = extractedFingerprint;
    const nextQuestions = createReviewQuestions(extractedQuestions);
    setReviewQuestions(nextQuestions);
    setReviewIndex(0);
    const firstPage = nextQuestions[0]?.sourcePages[0];
    if (firstPage !== undefined) onPageChange(firstPage);
    setIsDrawing(false);

    if (illustrationPlan.candidates.length === 0) {
      setActivePanel("review");
      return;
    }

    setActivePanel("illustrations");
    if (automaticIllustrationFingerprintRef.current !== illustrationPlan.fingerprint) {
      automaticIllustrationFingerprintRef.current = illustrationPlan.fingerprint;
      window.setTimeout(onGenerateAllIllustrations, 0);
    }
  }, [
    extractedFingerprint,
    extractedQuestions,
    extractionAllCompleted,
    illustrationPlan.candidates.length,
    illustrationPlan.fingerprint,
    onGenerateAllIllustrations,
    onPageChange
  ]);

  useEffect(() => {
    if (
      reviewQuestions.length === 0 ||
      !extractionAllCompleted ||
      illustrationPlan.candidates.length === 0 ||
      !illustrationsReady ||
      illustrationGeneration.status === "running"
    ) {
      return;
    }

    const firstPage = extractedQuestions[0]?.source_pages[0];
    if (firstPage !== undefined) onPageChange(firstPage);
    setIsDrawing(false);
    setActivePanel("review");
  }, [
    extractedQuestions,
    extractionAllCompleted,
    illustrationGeneration.status,
    illustrationPlan.candidates.length,
    illustrationsReady,
    onPageChange,
    reviewQuestions.length
  ]);


  const overlays = useMemo<readonly PdfOverlayRegion[]>(() => {
    if (mapping.data === null || activePanel !== "mapping") return [];
    const regions: PdfOverlayRegion[] = [];
    mapping.data.question_segments.forEach((segment, segmentIndex) => {
      if (segment.temporary_id !== mapping.selectedSegmentId) return;
      segment.page_regions.forEach((region) => {
        if (region.page !== currentPage) return;
        regions.push({
          id: region.client_id,
          regionId: region.client_id,
          segmentId: segment.temporary_id,
          label: getSegmentDisplayName(segment, segmentIndex),
          role: region.role,
          bbox: region.bbox,
          selected: region.client_id === mapping.selectedRegionId,
          segmentSelected: true
        });
      });
    });
    return regions;
  }, [activePanel, currentPage, mapping.data, mapping.selectedRegionId, mapping.selectedSegmentId]);

  const selectedRegionOwner = useMemo(() => {
    if (mapping.data === null || mapping.selectedRegionId === null) return null;
    for (const segment of mapping.data.question_segments) {
      if (segment.page_regions.some((region) => region.client_id === mapping.selectedRegionId)) {
        return segment.temporary_id;
      }
    }
    return null;
  }, [mapping.data, mapping.selectedRegionId]);

  useEffect(() => {
    setRenderError(null);
    setIsDrawing(false);
  }, [currentPage, zoom, mapping.selectedSegmentId]);

  useEffect(() => {
    if (mapping.status !== "completed") {
      setIsDrawing(false);
      setActivePanel("mapping");
    }
  }, [mapping.status]);

  useEffect(() => {
    if (extraction.runStatus === "running") {
      setIsDrawing(false);
      setActivePanel("extraction");
    }
  }, [extraction.runStatus]);

  useEffect(() => {
    if (illustrationGeneration.status === "running") {
      setIsDrawing(false);
      setActivePanel("illustrations");
    }
  }, [illustrationGeneration.status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        (event.key !== "Delete" && event.key !== "Backspace") ||
        isEditableElement(event.target) ||
        mapping.selectedRegionId === null ||
        selectedRegionOwner === null ||
        activePanel !== "mapping"
      ) return;
      event.preventDefault();
      onDeleteRegion(selectedRegionOwner, mapping.selectedRegionId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, mapping.selectedRegionId, onDeleteRegion, selectedRegionOwner]);

  const handleRegionAdd = useCallback((bbox: NormalizedBoundingBox): void => {
    if (mapping.selectedSegmentId === null) return;
    onAddRegion(mapping.selectedSegmentId, currentPage, drawingRole, bbox);
    setIsDrawing(false);
  }, [currentPage, drawingRole, mapping.selectedSegmentId, onAddRegion]);

  const handleValidateMapping = useCallback(async (): Promise<void> => {
    setIsDrawing(false);
    setPreparationError(null);
    automaticExtractionPendingRef.current = true;
    setActivePanel("preparing");
    try {
      await onValidateMapping();
      setActivePanel("extraction");
    } catch (error: unknown) {
      automaticExtractionPendingRef.current = false;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPreparationError(error instanceof Error ? error.message : String(error));
    }
  }, [onValidateMapping]);

  useEffect(() => {
    if (
      !automaticExtractionPendingRef.current ||
      activePanel !== "extraction" ||
      batching.plan === null ||
      extraction.runStatus === "running"
    ) {
      return;
    }

    const artifactsReady = batching.plan.batches.every(
      (batch) => batching.artifacts[batch.id] !== undefined
    );
    if (!artifactsReady) return;

    automaticExtractionPendingRef.current = false;
    onExtractAll();
  }, [
    activePanel,
    batching.artifacts,
    batching.plan,
    extraction.runStatus,
    onExtractAll
  ]);

  const handleReviewIndexChange = useCallback((index: number): void => {
    const nextIndex = Math.min(Math.max(0, index), Math.max(0, reviewQuestions.length - 1));
    if (nextIndex > reviewIndex) {
      setReviewQuestions((current) => current.map((question, questionIndex) =>
        questionIndex === reviewIndex ? { ...question, validated: true } : question
      ));
    }
    setReviewIndex(nextIndex);
    const page = reviewQuestions[nextIndex]?.sourcePages[0];
    if (page !== undefined) onPageChange(page);
  }, [onPageChange, reviewIndex, reviewQuestions]);

  const handleReviewQuestionChange = useCallback((question: ReviewQuestion): void => {
    setReviewQuestions((current) => current.map((entry) => entry.id === question.id ? question : entry));
  }, []);

  const handleReviewExport = useCallback(async (): Promise<void> => {
    if (mapping.data === null || reviewQuestions.length === 0) return;

    const finalizedQuestions = reviewQuestions.map((question, questionIndex) =>
      questionIndex === reviewIndex ? { ...question, validated: true } : question
    );
    setReviewQuestions(finalizedQuestions);
    setExporting(true);
    try {
      const value = await createReviewExport(
        pdf,
        mapping.data,
        finalizedQuestions,
        illustrationPlan,
        illustrationGeneration.assets
      );
      const archive = await createReviewArchive(
        value,
        illustrationPlan,
        illustrationGeneration.assets
      );
      downloadBlob(archive, exportFileName(pdf.fileName));
    } catch (error: unknown) {
      window.alert(`L’export ZIP a échoué : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setExporting(false);
    }
  }, [illustrationGeneration.assets, illustrationPlan, mapping.data, pdf, reviewIndex, reviewQuestions]);

  const completedMap = mapping.status === "completed" ? mapping.data : null;
  const mappingCompleted = completedMap !== null;

  return (
    <section className={`viewer-shell${showSidePanel ? " viewer-shell--with-mapping" : ""}`} aria-label="Visualiseur PDF">
      {activePanel === "review" && mappingCompleted && reviewQuestions.length > 0 ? (
        <QuestionReview
          currentIndex={reviewIndex}
          currentPage={currentPage}
          documentMap={completedMap}
          exporting={exporting}
          illustrationAssets={illustrationGeneration.assets}
          illustrationPlan={illustrationPlan}
          onCurrentIndexChange={handleReviewIndexChange}
          onCurrentPageChange={onPageChange}
          onExport={() => void handleReviewExport()}
          onQuestionChange={handleReviewQuestionChange}
          onResetZoom={onResetZoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          pdf={pdf}
          questions={reviewQuestions}
          zoom={zoom}
        />
      ) : (
        <>
          <PdfToolbar
            currentPage={currentPage}
            onAnalyze={mapping.status === "idle" ? onAnalyze : undefined}
            onPageChange={onPageChange}
            onResetZoom={onResetZoom}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            pageCount={pdf.pageCount}
            zoom={zoom}
          />

          <div className={`viewer-layout${showSidePanel ? " viewer-layout--with-mapping" : ""}`}>
            <main ref={pageWorkspaceRef} className="page-workspace">
              {renderError !== null && (
                <div className="inline-error" role="alert">
                  Une erreur est survenue pendant le rendu de la page : {renderError}
                </div>
              )}
              <div className="page-stage">
                <PdfPageCanvas
                  document={pdf.document}
                  drawRole={isDrawing && activePanel === "mapping" ? drawingRole : null}
                  onOverlaySelect={extraction.runStatus === "running" || illustrationGeneration.status === "running" ? undefined : onSelectRegion}
                  onRegionAdd={extraction.runStatus === "running" || illustrationGeneration.status === "running" ? undefined : handleRegionAdd}
                  onRegionChange={activePanel === "mapping" && extraction.runStatus !== "running" && illustrationGeneration.status !== "running" ? onUpdateRegionBbox : undefined}
                  onRegionDelete={activePanel === "mapping" ? onDeleteRegion : undefined}
                  onRegionRoleChange={activePanel === "mapping" ? onUpdateRegionRole : undefined}
                  onRenderError={handleRenderError}
                  overlays={overlays}
                  pageNumber={currentPage}
                  scale={zoom}
                />
              </div>
            </main>

            {showSidePanel && (
              <div className="side-panel-shell">
                {activePanel === "preparing" ? (
                  <PreparationPanel
                    batching={batching}
                    error={preparationError}
                    onRetry={() => void handleValidateMapping()}
                  />
                ) : activePanel === "extraction" && mappingCompleted ? (
                  <ExtractionPanel
                    documentMap={completedMap}
                    extraction={extraction}
                    onCancel={onCancelExtraction}
                    onExtractAll={onExtractAll}
                    onSelectSegment={onSelectSegment}
                    plan={batching.plan}
                  />
                ) : activePanel === "illustrations" && mappingCompleted ? (
                  <IllustrationPanel
                    generation={illustrationGeneration}
                    onCancel={onCancelIllustrationGeneration}
                    onClear={onClearIllustrations}
                    onDownload={onDownloadIllustration}
                    onGenerateAll={onGenerateAllIllustrations}
                    onGenerateOne={onGenerateIllustration}
                    onPageChange={onPageChange}
                    onSelectSegment={onSelectSegment}
                    plan={illustrationPlan}
                  />
                ) : (
                  <MappingPanel
                    currentPage={currentPage}
                    drawingRole={drawingRole}
                    isDrawing={isDrawing}
                    mapping={mapping}
                    onAnalyze={onAnalyze}
                    onCancel={onCancelMapping}
                    onDeleteSegment={onDeleteSegment}
                    onDrawingRoleChange={setDrawingRole}
                    onSelectRegion={onSelectRegion}
                    onSelectSegment={onSelectSegment}
                    onToggleDrawing={() => setIsDrawing((active) => !active)}
                    onValidate={() => void handleValidateMapping()}
                  />
                )}
             </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
