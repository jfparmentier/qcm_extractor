import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSegmentDisplayName } from "../domain/documentMap.js";
import { formatFileSize } from "../pdf/formatFileSize.js";
import { CloseIcon, FileIcon, SparklesIcon } from "./Icons.js";
import { MappingPanel } from "./MappingPanel.js";
import { PdfPageCanvas } from "./PdfPageCanvas.js";
import { PdfToolbar } from "./PdfToolbar.js";
function isEditableElement(target) {
    return target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
}
export function PdfViewer({ pdf, currentPage, zoom, mapping, onAnalyze, onCancelMapping, onSelectSegment, onSelectRegion, onUpdateRegionBbox, onUpdateRegionRole, onAddRegion, onDeleteRegion, onPageChange, onZoomIn, onZoomOut, onResetZoom, onClose }) {
    const [renderError, setRenderError] = useState(null);
    const [drawingRole, setDrawingRole] = useState("question");
    const [isDrawing, setIsDrawing] = useState(false);
    const handleRenderError = useCallback((message) => setRenderError(message), []);
    const showMappingPanel = mapping.status !== "idle";
    const overlays = useMemo(() => {
        if (mapping.data === null) {
            return [];
        }
        const regions = [];
        mapping.data.question_segments.forEach((segment, segmentIndex) => {
            segment.page_regions.forEach((region) => {
                if (region.page !== currentPage) {
                    return;
                }
                regions.push({
                    id: region.client_id,
                    regionId: region.client_id,
                    segmentId: segment.temporary_id,
                    label: getSegmentDisplayName(segment, segmentIndex),
                    role: region.role,
                    bbox: region.bbox,
                    selected: region.client_id === mapping.selectedRegionId,
                    segmentSelected: segment.temporary_id === mapping.selectedSegmentId
                });
            });
        });
        return regions;
    }, [currentPage, mapping.data, mapping.selectedRegionId, mapping.selectedSegmentId]);
    const selectedRegionOwner = useMemo(() => {
        if (mapping.data === null || mapping.selectedRegionId === null) {
            return null;
        }
        for (const segment of mapping.data.question_segments) {
            if (segment.page_regions.some((region) => region.client_id === mapping.selectedRegionId)) {
                return segment.temporary_id;
            }
        }
        return null;
    }, [mapping.data, mapping.selectedRegionId]);
    useEffect(() => {
        setRenderError(null);
        setIsDrawing(false);
    }, [currentPage, zoom, mapping.selectedSegmentId]);
    useEffect(() => {
        if (mapping.status !== "completed") {
            setIsDrawing(false);
        }
    }, [mapping.status]);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.key !== "Delete" && event.key !== "Backspace") ||
                isEditableElement(event.target) ||
                mapping.selectedRegionId === null ||
                selectedRegionOwner === null) {
                return;
            }
            event.preventDefault();
            onDeleteRegion(selectedRegionOwner, mapping.selectedRegionId);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mapping.selectedRegionId, onDeleteRegion, selectedRegionOwner]);
    const handleRegionAdd = useCallback((bbox) => {
        if (mapping.selectedSegmentId === null) {
            return;
        }
        onAddRegion(mapping.selectedSegmentId, currentPage, drawingRole, bbox);
        setIsDrawing(false);
    }, [currentPage, drawingRole, mapping.selectedSegmentId, onAddRegion]);
    return (_jsxs("section", { className: `viewer-shell${showMappingPanel ? " viewer-shell--with-mapping" : ""}`, "aria-label": "Visualiseur PDF", children: [_jsxs("header", { className: "document-header", children: [_jsxs("div", { className: "document-header__identity", children: [_jsx("span", { className: "document-header__icon", children: _jsx(FileIcon, {}) }), _jsxs("div", { className: "document-header__text", children: [_jsx("strong", { title: pdf.fileName, children: pdf.title ?? pdf.fileName }), _jsxs("span", { children: [pdf.pageCount, " page", pdf.pageCount > 1 ? "s" : "", " \u00B7 ", formatFileSize(pdf.fileSize), pdf.author !== null ? ` · ${pdf.author}` : ""] })] })] }), _jsxs("div", { className: "document-header__actions", children: [_jsx("span", { className: "local-badge", children: "PDF en m\u00E9moire" }), _jsxs("button", { className: "button button--primary analysis-header-button", disabled: mapping.status === "running", onClick: onAnalyze, type: "button", children: [_jsx(SparklesIcon, {}), mapping.status === "completed" ? "Recartographier" : "Cartographier"] }), _jsx("button", { "aria-label": "Fermer le document", className: "icon-button icon-button--quiet", onClick: onClose, title: "Fermer le document", type: "button", children: _jsx(CloseIcon, {}) })] })] }), _jsx(PdfToolbar, { currentPage: currentPage, onPageChange: onPageChange, onResetZoom: onResetZoom, onZoomIn: onZoomIn, onZoomOut: onZoomOut, pageCount: pdf.pageCount, zoom: zoom }), _jsxs("div", { className: `viewer-layout${showMappingPanel ? " viewer-layout--with-mapping" : ""}`, children: [_jsxs("main", { className: "page-workspace", children: [renderError !== null && (_jsxs("div", { className: "inline-error", role: "alert", children: ["Une erreur est survenue pendant le rendu de la page : ", renderError] })), _jsx("div", { className: "page-stage", children: _jsx(PdfPageCanvas, { document: pdf.document, drawRole: isDrawing ? drawingRole : null, onOverlaySelect: onSelectRegion, onRegionAdd: handleRegionAdd, onRegionChange: onUpdateRegionBbox, onRenderError: handleRenderError, overlays: overlays, pageNumber: currentPage, scale: zoom }) })] }), showMappingPanel && (_jsx(MappingPanel, { currentPage: currentPage, drawingRole: drawingRole, isDrawing: isDrawing, mapping: mapping, onAnalyze: onAnalyze, onCancel: onCancelMapping, onDeleteRegion: onDeleteRegion, onDrawingRoleChange: setDrawingRole, onSelectRegion: onSelectRegion, onSelectSegment: onSelectSegment, onToggleDrawing: () => setIsDrawing((active) => !active), onUpdateRegionRole: onUpdateRegionRole }))] })] }));
}
