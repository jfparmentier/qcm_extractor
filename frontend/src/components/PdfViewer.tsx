import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoadedPdf, MappingState } from "../domain/projectState";
import { getSegmentDisplayName } from "../domain/documentMap";
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
  readonly onPageChange: (page: number) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onResetZoom: () => void;
  readonly onClose: () => void;
}

export function PdfViewer({
  pdf,
  currentPage,
  zoom,
  mapping,
  onAnalyze,
  onCancelMapping,
  onSelectSegment,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onClose
}: PdfViewerProps): React.ReactElement {
  const [renderError, setRenderError] = useState<string | null>(null);
  const handleRenderError = useCallback((message: string) => setRenderError(message), []);
  const showMappingPanel = mapping.status !== "idle";

  const overlays = useMemo<readonly PdfOverlayRegion[]>(() => {
    if (mapping.data === null) {
      return [];
    }

    const regions: PdfOverlayRegion[] = [];
    mapping.data.question_segments.forEach((segment, segmentIndex) => {
      segment.page_regions.forEach((region, regionIndex) => {
        if (region.page !== currentPage || region.role === "decorative_image") {
          return;
        }

        regions.push({
          id: `${segment.temporary_id}-${regionIndex}`,
          segmentId: segment.temporary_id,
          label: getSegmentDisplayName(segment, segmentIndex),
          role: region.role,
          bbox: region.bbox,
          selected: segment.temporary_id === mapping.selectedSegmentId
        });
      });
    });

    return regions;
  }, [currentPage, mapping.data, mapping.selectedSegmentId]);

  useEffect(() => {
    setRenderError(null);
  }, [currentPage, zoom]);

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
              onOverlaySelect={onSelectSegment}
              onRenderError={handleRenderError}
              overlays={overlays}
              pageNumber={currentPage}
              scale={zoom}
            />
          </div>
        </main>

        {showMappingPanel && (
          <MappingPanel
            mapping={mapping}
            onAnalyze={onAnalyze}
            onCancel={onCancelMapping}
            onSelectSegment={onSelectSegment}
          />
        )}
      </div>
    </section>
  );
}
