import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSegmentDisplayName } from "../domain/documentMap.js";
import { mergeExtractionResults } from "../domain/extraction.js";
import { createReviewExport, createReviewQuestions, downloadJson, exportFileName, reviewSourceFingerprint } from "../domain/review.js";
import { formatFileSize } from "../pdf/formatFileSize.js";
import { CheckIcon, CloseIcon, FileIcon, ImageIcon, LayersIcon, SelectionIcon, SparklesIcon } from "./Icons.js";
import { ExtractionPanel } from "./ExtractionPanel.js";
import { IllustrationPanel } from "./IllustrationPanel.js";
import { BatchPanel } from "./BatchPanel.js";
import { MappingPanel } from "./MappingPanel.js";
import { PdfPageCanvas } from "./PdfPageCanvas.js";
import { PdfToolbar } from "./PdfToolbar.js";
import { QuestionReview } from "./QuestionReview.js";
function isEditableElement(target) {
    return target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
}
export function PdfViewer({ pdf, currentPage, zoom, mapping, batching, extraction, illustrationPlan, illustrationGeneration, onAnalyze, onCancelMapping, onSelectSegment, onSelectRegion, onUpdateRegionBbox, onUpdateRegionRole, onAddRegion, onDeleteRegion, onUpdateBatchSettings, onPlanBatches, onGenerateBatch, onGenerateAllBatches, onDownloadBatch, onClearBatches, onUpdateExtractionSettings, onExtractAll, onExtractBatch, onCancelExtraction, onClearExtraction, onGenerateAllIllustrations, onGenerateIllustration, onCancelIllustrationGeneration, onClearIllustrations, onDownloadIllustration, onPageChange, onZoomIn, onZoomOut, onResetZoom, onClose }) {
    const [renderError, setRenderError] = useState(null);
    const [drawingRole, setDrawingRole] = useState("question");
    const [isDrawing, setIsDrawing] = useState(false);
    const [activePanel, setActivePanel] = useState("mapping");
    const [reviewQuestions, setReviewQuestions] = useState([]);
    const [reviewIndex, setReviewIndex] = useState(0);
    const [exporting, setExporting] = useState(false);
    const reviewFingerprintRef = useRef("");
    const handleRenderError = useCallback((message) => setRenderError(message), []);
    const showSidePanel = mapping.status !== "idle" && activePanel !== "review";
    const completedExtractions = useMemo(() => Object.entries(extraction.batches).flatMap(([batchId, batchState]) => batchState.status === "completed" && batchState.result !== null && batchState.meta !== null
        ? [{ batchId, result: batchState.result, meta: batchState.meta }]
        : []), [extraction.batches]);
    const mergedExtraction = useMemo(() => mapping.data === null
        ? null
        : mergeExtractionResults(mapping.data, completedExtractions), [completedExtractions, mapping.data]);
    const extractedQuestions = mergedExtraction?.questions ?? [];
    const extractedFingerprint = useMemo(() => reviewSourceFingerprint(extractedQuestions), [extractedQuestions]);
    const illustrationsReady = useMemo(() => illustrationPlan.candidates.every((candidate) => illustrationGeneration.assets[candidate.id] !== undefined), [illustrationGeneration.assets, illustrationPlan.candidates]);
    const missingIllustrationCount = useMemo(() => illustrationPlan.candidates.filter((candidate) => illustrationGeneration.assets[candidate.id] === undefined).length, [illustrationGeneration.assets, illustrationPlan.candidates]);
    useEffect(() => {
        if (extractedQuestions.length === 0) {
            reviewFingerprintRef.current = "";
            setReviewQuestions([]);
            setReviewIndex(0);
            if (activePanel === "review")
                setActivePanel("extraction");
            return;
        }
        if (extraction.runStatus !== "completed" || reviewFingerprintRef.current === extractedFingerprint) {
            return;
        }
        reviewFingerprintRef.current = extractedFingerprint;
        const nextQuestions = createReviewQuestions(extractedQuestions);
        setReviewQuestions(nextQuestions);
        setReviewIndex(0);
        const firstPage = nextQuestions[0]?.sourcePages[0];
        if (firstPage !== undefined)
            onPageChange(firstPage);
        setIsDrawing(false);
        setActivePanel(illustrationPlan.candidates.length > 0 ? "illustrations" : "review");
    }, [activePanel, extractedFingerprint, extractedQuestions, extraction.runStatus, illustrationPlan.candidates.length, onPageChange]);
    useEffect(() => {
        if (reviewQuestions.length === 0 ||
            extraction.runStatus !== "completed" ||
            illustrationPlan.candidates.length === 0 ||
            !illustrationsReady ||
            illustrationGeneration.status === "running") {
            return;
        }
        const firstPage = extractedQuestions[0]?.source_pages[0];
        if (firstPage !== undefined)
            onPageChange(firstPage);
        setIsDrawing(false);
        setActivePanel("review");
    }, [
        extraction.runStatus,
        illustrationGeneration.status,
        illustrationPlan.candidates.length,
        illustrationsReady,
        onPageChange,
        reviewQuestions.length,
        extractedQuestions
    ]);
    const overlays = useMemo(() => {
        if (mapping.data === null)
            return [];
        const regions = [];
        mapping.data.question_segments.forEach((segment, segmentIndex) => {
            segment.page_regions.forEach((region) => {
                if (region.page !== currentPage)
                    return;
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
        if (mapping.data === null || mapping.selectedRegionId === null)
            return null;
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
            setActivePanel("mapping");
        }
    }, [mapping.status]);
    useEffect(() => {
        if (extraction.runStatus === "running") {
            setIsDrawing(false);
            setActivePanel("extraction");
        }
    }, [extraction.runStatus]);
    useEffect(() => {
        if (illustrationGeneration.status === "running") {
            setIsDrawing(false);
            setActivePanel("illustrations");
        }
    }, [illustrationGeneration.status]);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.key !== "Delete" && event.key !== "Backspace") ||
                isEditableElement(event.target) ||
                mapping.selectedRegionId === null ||
                selectedRegionOwner === null ||
                activePanel !== "mapping")
                return;
            event.preventDefault();
            onDeleteRegion(selectedRegionOwner, mapping.selectedRegionId);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activePanel, mapping.selectedRegionId, onDeleteRegion, selectedRegionOwner]);
    const handleRegionAdd = useCallback((bbox) => {
        if (mapping.selectedSegmentId === null)
            return;
        onAddRegion(mapping.selectedSegmentId, currentPage, drawingRole, bbox);
        setIsDrawing(false);
    }, [currentPage, drawingRole, mapping.selectedSegmentId, onAddRegion]);
    const handleReviewIndexChange = useCallback((index) => {
        const nextIndex = Math.min(Math.max(0, index), Math.max(0, reviewQuestions.length - 1));
        setReviewIndex(nextIndex);
        const page = reviewQuestions[nextIndex]?.sourcePages[0];
        if (page !== undefined)
            onPageChange(page);
    }, [onPageChange, reviewQuestions]);
    const handleReviewQuestionChange = useCallback((question) => {
        setReviewQuestions((current) => current.map((entry) => entry.id === question.id ? question : entry));
    }, []);
    const handleReviewExport = useCallback(async () => {
        if (mapping.data === null || reviewQuestions.length === 0 || reviewQuestions.some((question) => !question.validated)) {
            return;
        }
        setExporting(true);
        try {
            const value = await createReviewExport(pdf, mapping.data, reviewQuestions, illustrationPlan, illustrationGeneration.assets);
            downloadJson(value, exportFileName(pdf.fileName));
        }
        catch (error) {
            window.alert(`L’export JSON a échoué : ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            setExporting(false);
        }
    }, [illustrationGeneration.assets, illustrationPlan, mapping.data, pdf, reviewQuestions]);
    const completedMap = mapping.status === "completed" ? mapping.data : null;
    const mappingCompleted = completedMap !== null;
    return (_jsxs("section", { className: `viewer-shell${showSidePanel ? " viewer-shell--with-mapping" : ""}`, "aria-label": "Visualiseur PDF", children: [_jsxs("header", { className: "document-header", children: [_jsxs("div", { className: "document-header__identity", children: [_jsx("span", { className: "document-header__icon", children: _jsx(FileIcon, {}) }), _jsxs("div", { className: "document-header__text", children: [_jsx("strong", { title: pdf.fileName, children: pdf.title ?? pdf.fileName }), _jsxs("span", { children: [pdf.pageCount, " page", pdf.pageCount > 1 ? "s" : "", " \u00B7 ", formatFileSize(pdf.fileSize), pdf.author !== null ? ` · ${pdf.author}` : ""] })] })] }), _jsxs("div", { className: "document-header__actions", children: [_jsx("span", { className: "local-badge", children: "PDF en m\u00E9moire" }), _jsxs("button", { className: "button button--primary analysis-header-button", disabled: mapping.status === "running" || batching.activeBatchId !== null || extraction.runStatus === "running" || illustrationGeneration.status === "running", onClick: onAnalyze, type: "button", children: [_jsx(SparklesIcon, {}), mapping.status === "completed" ? "Recartographier" : "Cartographier"] }), _jsx("button", { "aria-label": "Fermer le document", className: "icon-button icon-button--quiet", onClick: onClose, title: "Fermer le document", type: "button", children: _jsx(CloseIcon, {}) })] })] }), activePanel === "review" && mappingCompleted && reviewQuestions.length > 0 ? (_jsx(QuestionReview, { currentIndex: reviewIndex, currentPage: currentPage, documentMap: completedMap, exporting: exporting, illustrationAssets: illustrationGeneration.assets, illustrationPlan: illustrationPlan, onCurrentIndexChange: handleReviewIndexChange, onCurrentPageChange: onPageChange, onExit: () => setActivePanel(illustrationPlan.candidates.length > 0 ? "illustrations" : "extraction"), onExport: () => void handleReviewExport(), onQuestionChange: handleReviewQuestionChange, onResetZoom: onResetZoom, onZoomIn: onZoomIn, onZoomOut: onZoomOut, pdf: pdf, questions: reviewQuestions, zoom: zoom })) : (_jsxs(_Fragment, { children: [_jsx(PdfToolbar, { currentPage: currentPage, onPageChange: onPageChange, onResetZoom: onResetZoom, onZoomIn: onZoomIn, onZoomOut: onZoomOut, pageCount: pdf.pageCount, zoom: zoom }), _jsxs("div", { className: `viewer-layout${showSidePanel ? " viewer-layout--with-mapping" : ""}`, children: [_jsxs("main", { className: "page-workspace", children: [renderError !== null && (_jsxs("div", { className: "inline-error", role: "alert", children: ["Une erreur est survenue pendant le rendu de la page : ", renderError] })), _jsx("div", { className: "page-stage", children: _jsx(PdfPageCanvas, { document: pdf.document, drawRole: isDrawing && activePanel === "mapping" ? drawingRole : null, onOverlaySelect: extraction.runStatus === "running" || illustrationGeneration.status === "running" ? undefined : onSelectRegion, onRegionAdd: extraction.runStatus === "running" || illustrationGeneration.status === "running" ? undefined : handleRegionAdd, onRegionChange: activePanel === "mapping" && extraction.runStatus !== "running" && illustrationGeneration.status !== "running" ? onUpdateRegionBbox : undefined, onRenderError: handleRenderError, overlays: overlays, pageNumber: currentPage, scale: zoom }) })] }), showSidePanel && (_jsxs("div", { className: "side-panel-shell", children: [mappingCompleted && (_jsxs("nav", { className: "side-panel-tabs", "aria-label": "\u00C9tapes du traitement", children: [_jsxs("button", { "aria-current": activePanel === "mapping" ? "page" : undefined, className: activePanel === "mapping" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab", disabled: extraction.runStatus === "running" || illustrationGeneration.status === "running", onClick: () => setActivePanel("mapping"), type: "button", children: [_jsx(SelectionIcon, {}), " Zones"] }), _jsxs("button", { "aria-current": activePanel === "batches" ? "page" : undefined, className: activePanel === "batches" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab", disabled: extraction.runStatus === "running" || illustrationGeneration.status === "running", onClick: () => { setIsDrawing(false); setActivePanel("batches"); }, type: "button", children: [_jsx(LayersIcon, {}), " Lots", batching.plan !== null && _jsx("span", { children: batching.plan.batches.length })] }), _jsxs("button", { "aria-current": activePanel === "extraction" ? "page" : undefined, className: activePanel === "extraction" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab", disabled: batching.plan === null, onClick: () => { setIsDrawing(false); setActivePanel("extraction"); }, type: "button", children: [_jsx(SparklesIcon, {}), " Extraction", Object.values(extraction.batches).some((batch) => batch.status === "completed") && (_jsx("span", { children: Object.values(extraction.batches).filter((batch) => batch.status === "completed").length }))] }), _jsxs("button", { "aria-current": activePanel === "illustrations" ? "page" : undefined, className: activePanel === "illustrations" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab", disabled: illustrationPlan.candidates.length === 0 || extraction.runStatus === "running", onClick: () => { setIsDrawing(false); setActivePanel("illustrations"); }, type: "button", children: [_jsx(ImageIcon, {}), " Images", illustrationPlan.candidates.length > 0 && _jsx("span", { children: illustrationPlan.candidates.length })] }), _jsxs("button", { "aria-current": activePanel === "review" ? "page" : undefined, className: activePanel === "review" ? "side-panel-tab side-panel-tab--active" : "side-panel-tab", disabled: reviewQuestions.length === 0 ||
                                                    extraction.runStatus === "running" ||
                                                    !illustrationsReady, onClick: () => {
                                                    if (!illustrationsReady)
                                                        return;
                                                    setIsDrawing(false);
                                                    setActivePanel("review");
                                                    handleReviewIndexChange(reviewIndex);
                                                }, title: !illustrationsReady
                                                    ? `La révision sera disponible après l’extraction de ${missingIllustrationCount} illustration${missingIllustrationCount > 1 ? "s" : ""}.`
                                                    : "Réviser les questions extraites", type: "button", children: [_jsx(CheckIcon, {}), " R\u00E9vision", reviewQuestions.length > 0 && _jsxs("span", { children: [reviewQuestions.filter((question) => question.validated).length, "/", reviewQuestions.length] })] })] })), activePanel === "batches" && mappingCompleted ? (_jsx(BatchPanel, { batching: batching, documentMap: completedMap, onClear: onClearBatches, onDownloadBatch: onDownloadBatch, onGenerateAll: onGenerateAllBatches, onGenerateBatch: onGenerateBatch, onPlan: onPlanBatches, onSelectSegment: onSelectSegment, onSettingsChange: onUpdateBatchSettings })) : activePanel === "extraction" && mappingCompleted ? (_jsx(ExtractionPanel, { documentMap: completedMap, extraction: extraction, onCancel: onCancelExtraction, onClear: onClearExtraction, onExtractAll: onExtractAll, onExtractBatch: onExtractBatch, onSelectSegment: onSelectSegment, onSettingsChange: onUpdateExtractionSettings, plan: batching.plan })) : activePanel === "illustrations" && mappingCompleted ? (_jsx(IllustrationPanel, { generation: illustrationGeneration, onCancel: onCancelIllustrationGeneration, onClear: onClearIllustrations, onDownload: onDownloadIllustration, onGenerateAll: onGenerateAllIllustrations, onGenerateOne: onGenerateIllustration, onPageChange: onPageChange, onSelectSegment: onSelectSegment, plan: illustrationPlan })) : (_jsx(MappingPanel, { currentPage: currentPage, drawingRole: drawingRole, isDrawing: isDrawing, mapping: mapping, onAnalyze: onAnalyze, onCancel: onCancelMapping, onDeleteRegion: onDeleteRegion, onDrawingRoleChange: setDrawingRole, onSelectRegion: onSelectRegion, onSelectSegment: onSelectSegment, onToggleDrawing: () => setIsDrawing((active) => !active), onUpdateRegionRole: onUpdateRegionRole }))] }))] })] }))] }));
}
