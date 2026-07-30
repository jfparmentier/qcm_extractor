import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

interface PdfPageCanvasProps {
  readonly document: PDFDocumentProxy;
  readonly pageNumber: number;
  readonly scale: number;
  readonly className?: string;
  readonly onRenderError?: (message: string) => void;
}

export function PdfPageCanvas({
  document,
  pageNumber,
  scale,
  className,
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
    </div>
  );
}
