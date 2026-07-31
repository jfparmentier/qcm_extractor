import { useEffect } from "react";
import { ZOOM_STEP } from "../domain/projectState.js";
function isEditableTarget(target) {
    return (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable));
}
export function useKeyboardNavigation({ enabled, onPreviousPage, onNextPage, onZoomIn, onZoomOut, onResetZoom }) {
    useEffect(() => {
        if (!enabled) {
            return undefined;
        }
        const handleKeyDown = (event) => {
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
