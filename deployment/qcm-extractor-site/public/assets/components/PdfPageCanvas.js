import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
function regionRoleLabel(role) {
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
export function PdfPageCanvas({ document, pageNumber, scale, className, overlays = [], onOverlaySelect, onRenderError }) {
    const canvasRef = useRef(null);
    const renderTaskRef = useRef(null);
    const [isRendering, setIsRendering] = useState(true);
    useEffect(() => {
        let isDisposed = false;
        setIsRendering(true);
        const renderPage = async () => {
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
            }
            catch (error) {
                if (error instanceof Error && error.name === "RenderingCancelledException") {
                    return;
                }
                throw error;
            }
        };
        renderPage().catch((error) => {
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
    return (_jsxs("div", { className: `pdf-canvas-frame${className !== undefined ? ` ${className}` : ""}`, children: [isRendering && _jsx("span", { className: "canvas-loader", "aria-label": "Rendu de la page" }), _jsx("canvas", { ref: canvasRef, "aria-label": `Page ${pageNumber} du document PDF`, className: "pdf-canvas" }), !isRendering && overlays.length > 0 && (_jsx("div", { className: "pdf-region-layer", "aria-label": "R\u00E9gions d\u00E9tect\u00E9es sur cette page", children: overlays.map((overlay) => (_jsx("button", { "aria-label": `${overlay.label} — ${regionRoleLabel(overlay.role)}`, className: `pdf-region pdf-region--${overlay.role}${overlay.selected ? " pdf-region--selected" : ""}`, onClick: () => onOverlaySelect?.(overlay.segmentId), style: {
                        left: `${overlay.bbox.x * 100}%`,
                        top: `${overlay.bbox.y * 100}%`,
                        width: `${overlay.bbox.width * 100}%`,
                        height: `${overlay.bbox.height * 100}%`
                    }, title: `${overlay.label} · ${regionRoleLabel(overlay.role)}`, type: "button", children: _jsx("span", { children: regionRoleLabel(overlay.role) }) }, overlay.id))) }))] }));
}
