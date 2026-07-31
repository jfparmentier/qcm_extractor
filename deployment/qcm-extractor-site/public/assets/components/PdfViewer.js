import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSegmentDisplayName } from "../domain/documentMap.js";
import { formatFileSize } from "../pdf/formatFileSize.js";
import { CloseIcon, FileIcon, SparklesIcon } from "./Icons.js";
import { MappingPanel } from "./MappingPanel.js";
import { PdfPageCanvas } from "./PdfPageCanvas.js";
import { PdfThumbnail } from "./PdfThumbnail.js";
import { PdfToolbar } from "./PdfToolbar.js";
export function PdfViewer({ pdf, currentPage, zoom, mapping, onAnalyze, onCancelMapping, onSelectSegment, onPageChange, onZoomIn, onZoomOut, onResetZoom, onClose }) {
    const [renderError, setRenderError] = useState(null);
    const pageNumbers = Array.from({ length: pdf.pageCount }, (_, index) => index + 1);
    const handleRenderError = useCallback((message) => setRenderError(message), []);
    const showMappingPanel = mapping.status !== "idle";
    const overlays = useMemo(() => {
        if (mapping.data === null) {
            return [];
        }
        const regions = [];
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
    return (_jsxs("section", { className: `viewer-shell${showMappingPanel ? " viewer-shell--with-mapping" : ""}`, "aria-label": "Visualiseur PDF", children: [_jsxs("header", { className: "document-header", children: [_jsxs("div", { className: "document-header__identity", children: [_jsx("span", { className: "document-header__icon", children: _jsx(FileIcon, {}) }), _jsxs("div", { className: "document-header__text", children: [_jsx("strong", { title: pdf.fileName, children: pdf.title ?? pdf.fileName }), _jsxs("span", { children: [pdf.pageCount, " page", pdf.pageCount > 1 ? "s" : "", " \u00B7 ", formatFileSize(pdf.fileSize), pdf.author !== null ? ` · ${pdf.author}` : ""] })] })] }), _jsxs("div", { className: "document-header__actions", children: [_jsx("span", { className: "local-badge", children: "PDF en m\u00E9moire" }), _jsxs("button", { className: "button button--primary analysis-header-button", disabled: mapping.status === "running", onClick: onAnalyze, type: "button", children: [_jsx(SparklesIcon, {}), mapping.status === "completed" ? "Recartographier" : "Cartographier"] }), _jsx("button", { "aria-label": "Fermer le document", className: "icon-button icon-button--quiet", onClick: onClose, title: "Fermer le document", type: "button", children: _jsx(CloseIcon, {}) })] })] }), _jsx(PdfToolbar, { currentPage: currentPage, onPageChange: onPageChange, onResetZoom: onResetZoom, onZoomIn: onZoomIn, onZoomOut: onZoomOut, pageCount: pdf.pageCount, zoom: zoom }), _jsxs("div", { className: `viewer-layout${showMappingPanel ? " viewer-layout--with-mapping" : ""}`, children: [_jsxs("aside", { className: "thumbnail-sidebar", "aria-label": "Miniatures des pages", children: [_jsxs("div", { className: "thumbnail-sidebar__heading", children: [_jsx("span", { children: "Pages" }), _jsx("span", { children: pdf.pageCount })] }), _jsx("nav", { className: "thumbnail-list", "aria-label": "Navigation par page", children: pageNumbers.map((pageNumber) => (_jsx(PdfThumbnail, { document: pdf.document, onSelect: onPageChange, pageNumber: pageNumber, selected: pageNumber === currentPage }, pageNumber))) })] }), _jsxs("main", { className: "page-workspace", children: [renderError !== null && (_jsxs("div", { className: "inline-error", role: "alert", children: ["Une erreur est survenue pendant le rendu de la page : ", renderError] })), _jsx("div", { className: "page-stage", children: _jsx(PdfPageCanvas, { document: pdf.document, onOverlaySelect: onSelectSegment, onRenderError: handleRenderError, overlays: overlays, pageNumber: currentPage, scale: zoom }) })] }), showMappingPanel && (_jsx(MappingPanel, { mapping: mapping, onAnalyze: onAnalyze, onCancel: onCancelMapping, onSelectSegment: onSelectSegment }))] })] }));
}
