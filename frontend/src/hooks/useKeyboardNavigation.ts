import { useEffect } from "react";
import { ZOOM_STEP } from "../domain/projectState";

interface KeyboardNavigationOptions {
  readonly enabled: boolean;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onResetZoom: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function useKeyboardNavigation({
  enabled,
  onPreviousPage,
  onNextPage,
  onZoomIn,
  onZoomOut,
  onResetZoom
}: KeyboardNavigationOptions): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) {
        return;
      }

      switch (event.key) {
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          onPreviousPage();
          break;
        case "ArrowRight":
        case "PageDown":
          event.preventDefault();
          onNextPage();
          break;
        case "+":
        case "=":
          event.preventDefault();
          onZoomIn();
          break;
        case "-":
          event.preventDefault();
          onZoomOut();
          break;
        case "0":
          event.preventDefault();
          onResetZoom();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    onNextPage,
    onPreviousPage,
    onResetZoom,
    onZoomIn,
    onZoomOut
  ]);
}

export const KEYBOARD_ZOOM_STEP = ZOOM_STEP;
