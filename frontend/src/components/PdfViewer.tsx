import { useCallback, useEffect, useMemo, useState } from "react";
import type { BatchSettings } from "../domain/batchPlan";
import type {
  BatchPreparationState,
  ExtractionSettings,
  ExtractionState,
  LoadedPdf,
  MappingState
} from "../domain/projectState";
import type {
  IllustrationGenerationState,
  IllustrationPlan
} from "../domain/illustration";
import {
  getSegmentDisplayName,
  type NormalizedBoundingBox,
  type PageRegionRole
} from "../domain/documentMap";
import { formatFileSize } from "../pdf/formatFileSize";
import { CloseIcon, FileIcon, ImageIcon, LayersIcon, SelectionIcon, SparklesIcon } from "./Icons";
import { ExtractionPanel } from "./ExtractionPanel";
import { IllustrationPanel } from "./IllustrationPanel";
import { BatchPanel } from "./BatchPanel";
import { MappingPanel } from "./MappingPanel";
import { PdfPageCanvas, type PdfOverlayRegion } from "./PdfPageCanvas";
import { PdfToolbar } from "./PdfToolbar";

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
  readonly onUpdateBatchSettings: (settings: BatchSettings) => void;
  readonly onPlanBatches: () => void;
  readonly onGenerateBatch: (batchId: string) => void;
  readonly onGenerateAllBatches: () => void;
  readonly onDownloadBatch: (batchId: string) => void;
  readonly onClearBatches: () => void;
  readonly onUpdateExtractionSettings: (settings: ExtractionSettings) => void;
  readonly onExtractAll: () => void;
  readonly onExtractBatch: (batchId: string) => void;
  readonly onCancelExtraction: () => void;
  readonly onClearExtraction: () => void;
  readonly onGenerateAllIllustrations: () => void;
  readonly onGenerateIllustration: (candidateId: string) => void;
  readonly onCancelIllustrationGeneration: () => void;
  readonly onClearIllustrations: () => void;
  readonly onDownloadIllustration: (candidateId: string) => void;
  readonly onPageChange: (page: number) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onResetZoom: () => void;
  readonly onClose: () => void;
}

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
  onSelectSegment,
  onSelectRegion,
  onUpdateRegionBbox,
  onUpdateRegionRole,
  onAddRegion,
  onDeleteRegion,
  onUpdateBatchSettings,
  onPlanBatches,
  onGenerateBatch,
  onGenerateAllBatches,
  onDownloadBatch,
  onClearBatches,
  onUpdateExtractionSettings,
  onExtractAll,
  onExtractBatch,
  onCancelExtraction,
  onClearExtraction,
  onGenerateAllIllustrations,
  onGenerateIllustration,
  onCancelIllustrationGeneration,
  onClearIllustrations,
  onDownloadIllustration,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onClose
}: PdfViewerProps): React.ReactElement {
  const [renderError, setRenderError] = useState<string | null>(null);
  const [drawingRole, setDrawingRole] = useState<PageRegionRole>("question");
  const [isDrawing, setIsDrawing] = useState(false);
  const [activePanel, setActivePanel] = useState<"mapping" | "batches" | "extraction" | "illustrations">("mapping");
  const handleRenderError = useCallback((message: string) => setRenderError(message), []);
  const showSidePanel = mapping.status !== "idle";

  const overlays = useMemo<readonly PdfOverlayRegion[]>(() => {
    if (mapping.data === null) {
      return [];
    }

    const regions: PdfOverlayRegion[] = [];
    mapping.data.question_segments.forEach((segment, segmentIndex) => {
      segment.page_regions.forEach((region) => {
        if (region.page !== currentPage) {
          return;
        }

        regions.push({
          id: region.client_id,
          regionId: region.client_id,
          segmentId: segment.temporary_id,
          label: getSegmentDisplayName(segment, segmentIndex),
          role: region.role,
          bbox: region.bbox,
          selected: region.client_id === mapping.selectedRegionId,
          segmentSelected: segment.temporary_id === mapping.selectedSegmentId
        });
      });
    });

    return regions;
  }, [currentPage, mapping.data, mapping.selectedRegionId, mapping.selectedSegmentId]);

  const selectedRegionOwner = useMemo(() => {
    if (mapping.data === null || mapping.selectedRegionId === null) {
      return null;
    }

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
      ) {
        return;
      }

      event.preventDefault();
      onDeleteRegion(selectedRegionOwner, mapping.selectedRegionId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePanel, mapping.selectedRegionId, onDeleteRegion, selectedRegionOwner]);

  const handleRegionAdd = useCallback((bbox: NormalizedBoundingBox): void => {
    if (mapping.selectedSegmentId === null) {
      return;
    }

    onAddRegion(mapping.selectedSegmentId, currentPage, drawingRole, bbox);
    setIsDrawing(false);
  }, [currentPage, drawingRole, mapping.selectedSegmentId, onAddRegion]);

  const completedMap = mapping.status === "completed" ? mapping.data : null;
  const mappingCompleted = completedMap !== null;

  return (
    <section className={`viewer-shell${showSidePanel ? " viewer-shell--with-mapping" : ""}`} aria-label="Visualiseur PDF">
      <header className="document-header">
        <div className="document-header__identity">
          <span className="document-header__icon"><FileIcon /></span>
          <div className="document-header__text">
            <strong title={pdf.fileName}>{pdf.title ?? pdf.fileName}</strong>
            <span>
              {pdf.pageCount} page{pdf.pageCount > 1 ? "s" : ""} · {formatFileSize(pdf.fileSize)}
              {pdf.author !== null ? ` · ${pdf.author}` : ""}
            </span>
          </div>
        </div>

        <div className="document-header__actions">
          <span className="local-badge">PDF en mémoire</span>
          <button
            className="button button--primary analysis-header-button"
            disabled={mapping.status === "running" || batching.activeBatchId !== null || extraction.runStatus === "running" || illustrationGeneration.status === "running"}
            onClick={onAnalyze}
            type="button"
          >
            <SparklesIcon />
            {mapping.status === "completed" ? "Recartographier" : "Cartographier"}
          </button>
          <button
            aria-label="Fermer le document"
            className="icon-button icon-button--quiet"
            onClick={onClose}
            title="Fermer le document"
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <PdfToolbar
        currentPage={currentPage}
        onPageChange={onPageChange}
        onResetZoom={onResetZoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        pageCount={pdf.pageCount}
        zoom={zoom}
      />

      <div className={`viewer-layout${showSidePanel ? " viewer-layout--with-mapping" : ""}`}>
        <main className="page-workspace">
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
              onRenderError={handleRenderError}
              overlays={overlays}
              pageNumber={currentPage}
              scale={zoom}
            />
          </div>
        </main>

        {showSidePanel && (
          <div className="side-panel-shell">
            {mappingCompleted && (
              <nav className="side-panel-tabs" aria-label="Étapes du traitement">
                <button
                  aria-current={activePanel === "mapping" ? "page" : undefined}
                  className={activePanel === "mapping" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab"}
                  disabled={extraction.runStatus === "running" || illustrationGeneration.status === "running"}
                  onClick={() => setActivePanel("mapping")}
                  type="button"
                >
                  <SelectionIcon /> Zones
                </button>
                <button
                  aria-current={activePanel === "batches" ? "page" : undefined}
                  className={activePanel === "batches" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab"}
                  disabled={extraction.runStatus === "running" || illustrationGeneration.status === "running"}
                  onClick={() => {
                    setIsDrawing(false);
                    setActivePanel("batches");
                  }}
                  type="button"
                >
                  <LayersIcon /> Lots
                  {batching.plan !== null && <span>{batching.plan.batches.length}</span>}
                </button>
                <button
                  aria-current={activePanel === "extraction" ? "page" : undefined}
                  className={activePanel === "extraction" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab"}
                  disabled={batching.plan === null}
                  onClick={() => {
                    setIsDrawing(false);
                    setActivePanel("extraction");
                  }}
                  type="button"
                >
                  <SparklesIcon /> Extraction
                  {Object.values(extraction.batches).some((batch) => batch.status === "completed") && (
                    <span>{Object.values(extraction.batches).filter((batch) => batch.status === "completed").length}</span>
                  )}
                </button>
                <button
                  aria-current={activePanel === "illustrations" ? "page" : undefined}
                  className={activePanel === "illustrations" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab"}
                  disabled={illustrationPlan.candidates.length === 0 || extraction.runStatus === "running"}
                  onClick={() => {
                    setIsDrawing(false);
                    setActivePanel("illustrations");
                  }}
                  type="button"
                >
                  <ImageIcon /> Images
                  {illustrationPlan.candidates.length > 0 && <span>{illustrationPlan.candidates.length}</span>}
                </button>
              </nav>
            )}

            {activePanel === "batches" && mappingCompleted ? (
              <BatchPanel
                batching={batching}
                documentMap={completedMap}
                onClear={onClearBatches}
                onDownloadBatch={onDownloadBatch}
                onGenerateAll={onGenerateAllBatches}
                onGenerateBatch={onGenerateBatch}
                onPlan={onPlanBatches}
                onSelectSegment={onSelectSegment}
                onSettingsChange={onUpdateBatchSettings}
              />
            ) : activePanel === "extraction" && mappingCompleted ? (
              <ExtractionPanel
                documentMap={completedMap}
                extraction={extraction}
                onCancel={onCancelExtraction}
                onClear={onClearExtraction}
                onExtractAll={onExtractAll}
                onExtractBatch={onExtractBatch}
                onSelectSegment={onSelectSegment}
                onSettingsChange={onUpdateExtractionSettings}
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
                onDeleteRegion={onDeleteRegion}
                onDrawingRoleChange={setDrawingRole}
                onSelectRegion={onSelectRegion}
                onSelectSegment={onSelectSegment}
                onToggleDrawing={() => setIsDrawing((active) => !active)}
                onUpdateRegionRole={onUpdateRegionRole}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
