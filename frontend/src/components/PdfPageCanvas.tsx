import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  clampNormalizedBoundingBox,
  getPageRegionRoleLabel,
  type NormalizedBoundingBox,
  type PageRegionRole
} from "../domain/documentMap";

export interface PdfOverlayRegion {
  readonly id: string;
  readonly regionId: string;
  readonly segmentId: string;
  readonly label: string;
  readonly role: PageRegionRole;
  readonly bbox: NormalizedBoundingBox;
  readonly selected: boolean;
  readonly segmentSelected: boolean;
}

type ResizeHandle = "se";

type PointerInteraction =
  | {
      readonly kind: "move";
      readonly pointerId: number;
      readonly segmentId: string;
      readonly regionId: string;
      readonly startX: number;
      readonly startY: number;
      readonly initialBbox: NormalizedBoundingBox;
    }
  | {
      readonly kind: "resize";
      readonly pointerId: number;
      readonly segmentId: string;
      readonly regionId: string;
      readonly handle: ResizeHandle;
      readonly startX: number;
      readonly startY: number;
      readonly initialBbox: NormalizedBoundingBox;
    }
  | {
      readonly kind: "draw";
      readonly pointerId: number;
      readonly startX: number;
      readonly startY: number;
    };

interface PdfPageCanvasProps {
  readonly document: PDFDocumentProxy;
  readonly pageNumber: number;
  readonly scale: number;
  readonly className?: string;
  readonly overlays?: readonly PdfOverlayRegion[];
  readonly focusBbox?: NormalizedBoundingBox | null;
  readonly drawRole?: PageRegionRole | null;
  readonly onOverlaySelect?: (segmentId: string, regionId: string) => void;
  readonly onRegionChange?: (
    segmentId: string,
    regionId: string,
    bbox: NormalizedBoundingBox
  ) => void;
  readonly onRegionAdd?: (bbox: NormalizedBoundingBox) => void;
  readonly onRenderError?: (message: string) => void;
}

const MIN_REGION_SIZE = 0.015;
const RESIZE_HANDLES: readonly ResizeHandle[] = ["se"];

function normalizedPointerPosition(
  clientX: number,
  clientY: number,
  layer: HTMLElement
): { x: number; y: number } {
  const rect = layer.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / height))
  };
}

function movedBbox(
  initial: NormalizedBoundingBox,
  deltaX: number,
  deltaY: number
): NormalizedBoundingBox {
  return {
    ...initial,
    x: Math.min(1 - initial.width, Math.max(0, initial.x + deltaX)),
    y: Math.min(1 - initial.height, Math.max(0, initial.y + deltaY))
  };
}

function resizedBbox(
  initial: NormalizedBoundingBox,
  deltaX: number,
  deltaY: number,
  handle: ResizeHandle
): NormalizedBoundingBox {
  let left = initial.x;
  let top = initial.y;
  let right = initial.x + initial.width;
  let bottom = initial.y + initial.height;

  if (handle.includes("w")) {
    left = Math.min(right - MIN_REGION_SIZE, Math.max(0, left + deltaX));
  }
  if (handle.includes("e")) {
    right = Math.max(left + MIN_REGION_SIZE, Math.min(1, right + deltaX));
  }
  if (handle.includes("n")) {
    top = Math.min(bottom - MIN_REGION_SIZE, Math.max(0, top + deltaY));
  }
  if (handle.includes("s")) {
    bottom = Math.max(top + MIN_REGION_SIZE, Math.min(1, bottom + deltaY));
  }

  return clampNormalizedBoundingBox(
    {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    },
    MIN_REGION_SIZE
  );
}

function drawnBbox(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): NormalizedBoundingBox {
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY)
  };
}

export function PdfPageCanvas({
  document,
  pageNumber,
  scale,
  className,
  overlays = [],
  focusBbox = null,
  drawRole = null,
  onOverlaySelect,
  onRegionChange,
  onRegionAdd,
  onRenderError
}: PdfPageCanvasProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const draftBboxRef = useRef<NormalizedBoundingBox | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [draftBbox, setDraftBbox] = useState<NormalizedBoundingBox | null>(null);

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

      const focus = focusBbox === null
        ? { x: 0, y: 0, width: 1, height: 1 }
        : clampNormalizedBoundingBox(focusBbox, MIN_REGION_SIZE);
      const cssWidth = Math.max(1, viewport.width * focus.width);
      const cssHeight = Math.max(1, viewport.height * focus.height);
      canvas.width = Math.max(1, Math.floor(cssWidth * outputScale));
      canvas.height = Math.max(1, Math.floor(cssHeight * outputScale));
      canvas.style.width = `${Math.floor(cssWidth)}px`;
      canvas.style.height = `${Math.floor(cssHeight)}px`;

      renderTaskRef.current?.cancel();
      const offsetX = -viewport.width * focus.x * outputScale;
      const offsetY = -viewport.height * focus.y * outputScale;
      const renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: [outputScale, 0, 0, outputScale, offsetX, offsetY]
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
  }, [
    document,
    focusBbox?.height,
    focusBbox?.width,
    focusBbox?.x,
    focusBbox?.y,
    onRenderError,
    pageNumber,
    scale
  ]);

  useEffect(() => {
    interactionRef.current = null;
    draftBboxRef.current = null;
    setDraftBbox(null);
  }, [drawRole, pageNumber, scale]);

  const handlePointerMove = useCallback((event: PointerEvent): void => {
    const interaction = interactionRef.current;
    const layer = layerRef.current;
    if (interaction === null || layer === null || event.pointerId !== interaction.pointerId) {
      return;
    }

    event.preventDefault();
    const position = normalizedPointerPosition(event.clientX, event.clientY, layer);
    const deltaX = position.x - interaction.startX;
    const deltaY = position.y - interaction.startY;

    if (interaction.kind === "draw") {
      const nextDraft = drawnBbox(interaction.startX, interaction.startY, position.x, position.y);
      draftBboxRef.current = nextDraft;
      setDraftBbox(nextDraft);
      return;
    }

    const bbox = interaction.kind === "move"
      ? movedBbox(interaction.initialBbox, deltaX, deltaY)
      : resizedBbox(interaction.initialBbox, deltaX, deltaY, interaction.handle);
    onRegionChange?.(interaction.segmentId, interaction.regionId, bbox);
  }, [onRegionChange]);

  const finishPointerInteraction = useCallback((event: PointerEvent): void => {
    const interaction = interactionRef.current;
    if (interaction === null || event.pointerId !== interaction.pointerId) {
      return;
    }

    interactionRef.current = null;
    if (interaction.kind === "draw") {
      const bbox = draftBboxRef.current;
      draftBboxRef.current = null;
      setDraftBbox(null);
      if (
        bbox !== null &&
        bbox.width >= MIN_REGION_SIZE &&
        bbox.height >= MIN_REGION_SIZE
      ) {
        onRegionAdd?.(bbox);
      }
    }
  }, [onRegionAdd]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishPointerInteraction);
    window.addEventListener("pointercancel", finishPointerInteraction);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointerInteraction);
      window.removeEventListener("pointercancel", finishPointerInteraction);
    };
  }, [finishPointerInteraction, handlePointerMove]);

  const startDrawing = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (drawRole === null || layerRef.current === null || event.button !== 0) {
      return;
    }

    event.preventDefault();
    const position = normalizedPointerPosition(event.clientX, event.clientY, layerRef.current);
    interactionRef.current = {
      kind: "draw",
      pointerId: event.pointerId,
      startX: position.x,
      startY: position.y
    };
    const initialDraft = { x: position.x, y: position.y, width: 0, height: 0 };
    draftBboxRef.current = initialDraft;
    setDraftBbox(initialDraft);
  }, [drawRole]);

  const startMoving = useCallback((
    event: React.PointerEvent<HTMLButtonElement>,
    overlay: PdfOverlayRegion
  ): void => {
    if (drawRole !== null || layerRef.current === null || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onOverlaySelect?.(overlay.segmentId, overlay.regionId);
    const position = normalizedPointerPosition(event.clientX, event.clientY, layerRef.current);
    interactionRef.current = {
      kind: "move",
      pointerId: event.pointerId,
      segmentId: overlay.segmentId,
      regionId: overlay.regionId,
      startX: position.x,
      startY: position.y,
      initialBbox: overlay.bbox
    };
  }, [drawRole, onOverlaySelect]);

  const startResizing = useCallback((
    event: React.PointerEvent<HTMLSpanElement>,
    overlay: PdfOverlayRegion,
    handle: ResizeHandle
  ): void => {
    if (drawRole !== null || layerRef.current === null || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onOverlaySelect?.(overlay.segmentId, overlay.regionId);
    const position = normalizedPointerPosition(event.clientX, event.clientY, layerRef.current);
    interactionRef.current = {
      kind: "resize",
      pointerId: event.pointerId,
      segmentId: overlay.segmentId,
      regionId: overlay.regionId,
      handle,
      startX: position.x,
      startY: position.y,
      initialBbox: overlay.bbox
    };
  }, [drawRole, onOverlaySelect]);

  return (
    <div className={`pdf-canvas-frame${className !== undefined ? ` ${className}` : ""}`}>
      {isRendering && <span className="canvas-loader" aria-label="Rendu de la page" />}
      <canvas
        ref={canvasRef}
        aria-label={`Page ${pageNumber} du document PDF`}
        className="pdf-canvas"
      />
      {!isRendering && (overlays.length > 0 || drawRole !== null) && (
        <div
          ref={layerRef}
          aria-label="Régions détectées et éditables sur cette page"
          className={`pdf-region-layer${drawRole !== null ? " pdf-region-layer--drawing" : ""}`}
          onPointerDown={startDrawing}
        >
          {overlays.map((overlay) => (
            <button
              key={overlay.id}
              aria-label={`${overlay.label} — ${getPageRegionRoleLabel(overlay.role)}`}
              className={[
                "pdf-region",
                `pdf-region--${overlay.role}`,
                overlay.segmentSelected ? "pdf-region--segment-selected" : "",
                overlay.selected ? "pdf-region--selected" : ""
              ].filter(Boolean).join(" ")}
              onClick={() => onOverlaySelect?.(overlay.segmentId, overlay.regionId)}
              onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => startMoving(event, overlay)}
              style={{
                left: `${overlay.bbox.x * 100}%`,
                top: `${overlay.bbox.y * 100}%`,
                width: `${overlay.bbox.width * 100}%`,
                height: `${overlay.bbox.height * 100}%`
              }}
              title={`${overlay.label} · ${getPageRegionRoleLabel(overlay.role)}`}
              type="button"
            >
              <span className="pdf-region__label">{getPageRegionRoleLabel(overlay.role)}</span>
              {overlay.selected && RESIZE_HANDLES.map((handle) => (
                <span
                  key={handle}
                  aria-hidden="true"
                  className={`pdf-region__handle pdf-region__handle--${handle}`}
                  onPointerDown={(event: React.PointerEvent<HTMLSpanElement>) => startResizing(event, overlay, handle)}
                />
              ))}
            </button>
          ))}
          {draftBbox !== null && (
            <div
              aria-hidden="true"
              className={`pdf-region pdf-region--${drawRole ?? "question"} pdf-region--draft`}
              style={{
                left: `${draftBbox.x * 100}%`,
                top: `${draftBbox.y * 100}%`,
                width: `${draftBbox.width * 100}%`,
                height: `${draftBbox.height * 100}%`
              }}
            />
          )}
          {drawRole !== null && draftBbox === null && (
            <span className="pdf-draw-hint">
              Cliquez puis faites glisser pour tracer une zone « {getPageRegionRoleLabel(drawRole)} ».
            </span>
          )}
        </div>
      )}
    </div>
  );
}
