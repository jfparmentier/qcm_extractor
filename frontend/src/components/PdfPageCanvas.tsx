import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { NormalizedBoundingBox, PageRegionRole } from "../domain/documentMap";

export interface PdfOverlayRegion {
  readonly id: string;
  readonly segmentId: string;
  readonly label: string;
  readonly role: PageRegionRole;
  readonly bbox: NormalizedBoundingBox;
  readonly selected: boolean;
}

interface PdfPageCanvasProps {
  readonly document: PDFDocumentProxy;
  readonly pageNumber: number;
  readonly scale: number;
  readonly className?: string;
  readonly overlays?: readonly PdfOverlayRegion[];
  readonly onOverlaySelect?: (segmentId: string) => void;
  readonly onRenderError?: (message: string) => void;
}

function regionRoleLabel(role: PageRegionRole): string {
  switch (role) {
    case "question":
      return "Énoncé";
    case "choices":
      return "Propositions";
    case "answer":
      return "Réponse";
    case "feedback":
      return "Feedback";
    case "essential_image":
      return "Illustration essentielle";
    case "decorative_image":
      return "Illustration décorative";
    case "context":
      return "Contexte";
  }
}

export function PdfPageCanvas({
  document,
  pageNumber,
  scale,
  className,
  overlays = [],
  onOverlaySelect,
  onRenderError
}: PdfPageCanvasProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    let isDisposed = false;
    setIsRendering(true);

    const renderPage = async (): Promise<void> => {
      const page = await document.getPage(pageNumber);
      if (isDisposed || canvasRef.current === null) {
        return;
      }

      const viewport = page.getViewport({ scale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });

      if (context === null) {
        throw new Error("Le contexte de rendu Canvas 2D est indisponible.");
      }

      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      renderTaskRef.current?.cancel();
      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
      });
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;
        if (!isDisposed) {
          setIsRendering(false);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "RenderingCancelledException") {
          return;
        }
        throw error;
      }
    };

    renderPage().catch((error: unknown) => {
      if (!isDisposed) {
        setIsRendering(false);
        onRenderError?.(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      isDisposed = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [document, onRenderError, pageNumber, scale]);

  return (
    <div className={`pdf-canvas-frame${className !== undefined ? ` ${className}` : ""}`}>
      {isRendering && <span className="canvas-loader" aria-label="Rendu de la page" />}
      <canvas
        ref={canvasRef}
        aria-label={`Page ${pageNumber} du document PDF`}
        className="pdf-canvas"
      />
      {!isRendering && overlays.length > 0 && (
        <div className="pdf-region-layer" aria-label="Régions détectées sur cette page">
          {overlays.map((overlay) => (
            <button
              key={overlay.id}
              aria-label={`${overlay.label} — ${regionRoleLabel(overlay.role)}`}
              className={`pdf-region pdf-region--${overlay.role}${overlay.selected ? " pdf-region--selected" : ""}`}
              onClick={() => onOverlaySelect?.(overlay.segmentId)}
              style={{
                left: `${overlay.bbox.x * 100}%`,
                top: `${overlay.bbox.y * 100}%`,
                width: `${overlay.bbox.width * 100}%`,
                height: `${overlay.bbox.height * 100}%`
              }}
              title={`${overlay.label} · ${regionRoleLabel(overlay.role)}`}
              type="button"
            >
              <span>{regionRoleLabel(overlay.role)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
