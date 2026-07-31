import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { PdfPageCanvas } from "./PdfPageCanvas.js";
export function PdfThumbnail({ document, pageNumber, selected, onSelect }) {
    const itemRef = useRef(null);
    const [isVisible, setIsVisible] = useState(pageNumber <= 4);
    useEffect(() => {
        const element = itemRef.current;
        if (element === null || isVisible) {
            return undefined;
        }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: "250px" });
        observer.observe(element);
        return () => observer.disconnect();
    }, [isVisible]);
    useEffect(() => {
        if (selected) {
            itemRef.current?.scrollIntoView({ block: "nearest" });
        }
    }, [selected]);
    return (_jsxs("button", { ref: itemRef, "aria-current": selected ? "page" : undefined, "aria-label": `Afficher la page ${pageNumber}`, className: `thumbnail${selected ? " thumbnail--selected" : ""}`, onClick: () => onSelect(pageNumber), type: "button", children: [_jsx("span", { className: "thumbnail__page", children: isVisible ? (_jsx(PdfPageCanvas, { className: "pdf-canvas-frame--thumbnail", document: document, pageNumber: pageNumber, scale: 0.19 })) : (_jsx("span", { className: "thumbnail__placeholder" })) }), _jsx("span", { className: "thumbnail__number", children: pageNumber })] }));
}
