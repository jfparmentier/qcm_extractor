import { useCallback, useEffect, useState } from "react";
import type { LoadedPdf } from "../domain/projectState";
import { formatFileSize } from "../pdf/formatFileSize";
import { CloseIcon, FileIcon } from "./Icons";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { PdfThumbnail } from "./PdfThumbnail";
import { PdfToolbar } from "./PdfToolbar";

interface PdfViewerProps {
  readonly pdf: LoadedPdf;
  readonly currentPage: number;
  readonly zoom: number;
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
  onPageChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onClose
}: PdfViewerProps): React.ReactElement {
  const [renderError, setRenderError] = useState<string | null>(null);
  const pageNumbers = Array.from({ length: pdf.pageCount }, (_, index) => index + 1);
  const handleRenderError = useCallback((message: string) => setRenderError(message), []);

  useEffect(() => {
    setRenderError(null);
  }, [currentPage, zoom]);

  return (
    <section className="viewer-shell" aria-label="Visualiseur PDF">
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
          <span className="local-badge">Local</span>
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

      <div className="viewer-layout">
        <aside className="thumbnail-sidebar" aria-label="Miniatures des pages">
          <div className="thumbnail-sidebar__heading">
            <span>Pages</span>
            <span>{pdf.pageCount}</span>
          </div>
          <nav className="thumbnail-list" aria-label="Navigation par page">
            {pageNumbers.map((pageNumber) => (
              <PdfThumbnail
                key={pageNumber}
                document={pdf.document}
                onSelect={onPageChange}
                pageNumber={pageNumber}
                selected={pageNumber === currentPage}
              />
            ))}
          </nav>
        </aside>

        <main className="page-workspace">
          {renderError !== null && (
            <div className="inline-error" role="alert">
              Une erreur est survenue pendant le rendu de la page : {renderError}
            </div>
          )}
          <div className="page-stage">
            <PdfPageCanvas
              document={pdf.document}
              onRenderError={handleRenderError}
              pageNumber={currentPage}
              scale={zoom}
            />
          </div>
        </main>
      </div>
    </section>
  );
}
