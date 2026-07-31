import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoadedPdf, MappingState } from "../domain/projectState";
import {
  getSegmentDisplayName,
  type NormalizedBoundingBox,
  type PageRegionRole
} from "../domain/documentMap";
import { formatFileSize } from "../pdf/formatFileSize";
import { CloseIcon, FileIcon, SparklesIcon } from "./Icons";
import { MappingPanel } from "./MappingPanel";
import { PdfPageCanvas, type PdfOverlayRegion } from "./PdfPageCanvas";
import { PdfToolbar } from "./PdfToolbar";

interface PdfViewerProps {
  readonly pdf: LoadedPdf;
  readonly currentPage: number;
  readonly zoom: number;
  readonly mapping: MappingState;
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
  onAnalyze,
  onCancelMapping,
  onSelectSegment,
  onSelectRegion,
  onUpdateRegionBbox,
  onUpdateRegionRole,
  onAddRegion,
  onDeleteRegion,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onClose
}: PdfViewerProps): React.ReactElement {
  const [renderError, setRenderError] = useState<string | null>(null);
  const [drawingRole, setDrawingRole] = useState<PageRegionRole>("question");
  const [isDrawing, setIsDrawing] = useState(false);
  const handleRenderError = useCallback((message: string) => setRenderError(message), []);
  const showMappingPanel = mapping.status !== "idle";

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
    }
  }, [mapping.status]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        (event.key !== "Delete" && event.key !== "Backspace") ||
        isEditableElement(event.target) ||
        mapping.selectedRegionId === null ||
        selectedRegionOwner === null
      ) {
        return;
      }

      event.preventDefault();
      onDeleteRegion(selectedRegionOwner, mapping.selectedRegionId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mapping.selectedRegionId, onDeleteRegion, selectedRegionOwner]);

  const handleRegionAdd = useCallback((bbox: NormalizedBoundingBox): void => {
    if (mapping.selectedSegmentId === null) {
      return;
    }

    onAddRegion(mapping.selectedSegmentId, currentPage, drawingRole, bbox);
    setIsDrawing(false);
  }, [currentPage, drawingRole, mapping.selectedSegmentId, onAddRegion]);

  return (
    <section className={`viewer-shell${showMappingPanel ? " viewer-shell--with-mapping" : ""}`} aria-label="Visualiseur PDF">
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
            disabled={mapping.status === "running"}
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

      <div className={`viewer-layout${showMappingPanel ? " viewer-layout--with-mapping" : ""}`}>
        <main className="page-workspace">
          {renderError !== null && (
            <div className="inline-error" role="alert">
              Une erreur est survenue pendant le rendu de la page : {renderError}
            </div>
          )}
          <div className="page-stage">
            <PdfPageCanvas
              document={pdf.document}
              drawRole={isDrawing ? drawingRole : null}
              onOverlaySelect={onSelectRegion}
              onRegionAdd={handleRegionAdd}
              onRegionChange={onUpdateRegionBbox}
              onRenderError={handleRenderError}
              overlays={overlays}
              pageNumber={currentPage}
              scale={zoom}
            />
          </div>
        </main>

        {showMappingPanel && (
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
    </section>
  );
}
