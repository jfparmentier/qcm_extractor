import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSegmentDisplayName } from "../domain/documentMap.js?v=7.3.1";
import { mergeExtractionResults } from "../domain/extraction.js?v=7.3.1";
import { createReviewArchive, createReviewExport, createReviewQuestions, downloadBlob, exportFileName, reviewSourceFingerprint } from "../domain/review.js?v=7.3.1";
import { formatFileSize } from "../pdf/formatFileSize.js?v=7.3.1";
import { CloseIcon, FileIcon, SparklesIcon } from "./Icons.js?v=7.3.1";
import { ExtractionPanel } from "./ExtractionPanel.js?v=7.3.1";
import { IllustrationPanel } from "./IllustrationPanel.js?v=7.3.1";
import { MappingPanel } from "./MappingPanel.js?v=7.3.1";
import { PreparationPanel } from "./PreparationPanel.js?v=7.3.1";
import { PdfPageCanvas } from "./PdfPageCanvas.js?v=7.3.1";
import { PdfToolbar } from "./PdfToolbar.js?v=7.3.1";
import { QuestionReview } from "./QuestionReview.js?v=7.3.1";
function isEditableElement(target) {
    return target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
}
export function PdfViewer({ pdf, currentPage, zoom, mapping, batching, extraction, illustrationPlan, illustrationGeneration, onAnalyze, onCancelMapping, onValidateMapping, onSelectSegment, onSelectRegion, onUpdateRegionBbox, onUpdateRegionRole, onAddRegion, onDeleteRegion, onDeleteSegment, onExtractAll, onExtractBatch, onCancelExtraction, onClearExtraction, onGenerateAllIllustrations, onGenerateIllustration, onCancelIllustrationGeneration, onClearIllustrations, onDownloadIllustration, onPageChange, onZoomIn, onZoomOut, onResetZoom, onClose }) {
    const [renderError, setRenderError] = useState(null);
    const [drawingRole, setDrawingRole] = useState("question");
    const [isDrawing, setIsDrawing] = useState(false);
    const [activePanel, setActivePanel] = useState("mapping");
    const [reviewQuestions, setReviewQuestions] = useState([]);
    const [reviewIndex, setReviewIndex] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [preparationError, setPreparationError] = useState(null);
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
    const extractionAllCompleted = useMemo(() => {
        const plannedBatches = batching.plan?.batches ?? [];
        return plannedBatches.length > 0 && plannedBatches.every((batch) => extraction.batches[batch.id]?.status === "completed");
    }, [batching.plan, extraction.batches]);
    const automaticIllustrationFingerprintRef = useRef("");
    useEffect(() => {
        if (extractedQuestions.length === 0) {
            reviewFingerprintRef.current = "";
            automaticIllustrationFingerprintRef.current = "";
            setReviewQuestions([]);
            setReviewIndex(0);
            return;
        }
        if (!extractionAllCompleted || reviewFingerprintRef.current === extractedFingerprint) {
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
        if (illustrationPlan.candidates.length === 0) {
            setActivePanel("review");
            return;
        }
        setActivePanel("illustrations");
        if (automaticIllustrationFingerprintRef.current !== illustrationPlan.fingerprint) {
            automaticIllustrationFingerprintRef.current = illustrationPlan.fingerprint;
            window.setTimeout(onGenerateAllIllustrations, 0);
        }
    }, [
        extractedFingerprint,
        extractedQuestions,
        extractionAllCompleted,
        illustrationPlan.candidates.length,
        illustrationPlan.fingerprint,
        onGenerateAllIllustrations,
        onPageChange
    ]);
    useEffect(() => {
        if (reviewQuestions.length === 0 ||
            !extractionAllCompleted ||
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
        extractedQuestions,
        extractionAllCompleted,
        illustrationGeneration.status,
        illustrationPlan.candidates.length,
        illustrationsReady,
        onPageChange,
        reviewQuestions.length
    ]);
    const overlays = useMemo(() => {
        if (mapping.data === null || activePanel !== "mapping")
            return [];
        const regions = [];
        mapping.data.question_segments.forEach((segment, segmentIndex) => {
            if (segment.temporary_id !== mapping.selectedSegmentId)
                return;
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
                    segmentSelected: true
                });
            });
        });
        return regions;
    }, [activePanel, currentPage, mapping.data, mapping.selectedRegionId, mapping.selectedSegmentId]);
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
    const handleValidateMapping = useCallback(async () => {
        setIsDrawing(false);
        setPreparationError(null);
        setActivePanel("preparing");
        try {
            await onValidateMapping();
            setActivePanel("extraction");
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError")
                return;
            setPreparationError(error instanceof Error ? error.message : String(error));
        }
    }, [onValidateMapping]);
    const handleReviewIndexChange = useCallback((index) => {
        const nextIndex = Math.min(Math.max(0, index), Math.max(0, reviewQuestions.length - 1));
        if (nextIndex > reviewIndex) {
            setReviewQuestions((current) => current.map((question, questionIndex) => questionIndex === reviewIndex ? { ...question, validated: true } : question));
        }
        setReviewIndex(nextIndex);
        const page = reviewQuestions[nextIndex]?.sourcePages[0];
        if (page !== undefined)
            onPageChange(page);
    }, [onPageChange, reviewIndex, reviewQuestions]);
    const handleReviewQuestionChange = useCallback((question) => {
        setReviewQuestions((current) => current.map((entry) => entry.id === question.id ? question : entry));
    }, []);
    const handleReviewExport = useCallback(async () => {
        if (mapping.data === null || reviewQuestions.length === 0)
            return;
        const finalizedQuestions = reviewQuestions.map((question, questionIndex) => questionIndex === reviewIndex ? { ...question, validated: true } : question);
        setReviewQuestions(finalizedQuestions);
        setExporting(true);
        try {
            const value = await createReviewExport(pdf, mapping.data, finalizedQuestions, illustrationPlan, illustrationGeneration.assets);
            const archive = await createReviewArchive(value, illustrationPlan, illustrationGeneration.assets);
            downloadBlob(archive, exportFileName(pdf.fileName));
        }
        catch (error) {
            window.alert(`L’export ZIP a échoué : ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            setExporting(false);
        }
    }, [illustrationGeneration.assets, illustrationPlan, mapping.data, pdf, reviewIndex, reviewQuestions]);
    const completedMap = mapping.status === "completed" ? mapping.data : null;
    const mappingCompleted = completedMap !== null;
    return (_jsxs("section", { className: `viewer-shell${showSidePanel ? " viewer-shell--with-mapping" : ""}`, "aria-label": "Visualiseur PDF", children: [_jsxs("header", { className: "document-header", children: [_jsxs("div", { className: "document-header__identity", children: [_jsx("span", { className: "document-header__icon", children: _jsx(FileIcon, {}) }), _jsxs("div", { className: "document-header__text", children: [_jsx("strong", { title: pdf.fileName, children: pdf.title ?? pdf.fileName }), _jsxs("span", { children: [pdf.pageCount, " page", pdf.pageCount > 1 ? "s" : "", " \u00B7 ", formatFileSize(pdf.fileSize), pdf.author !== null ? ` · ${pdf.author}` : ""] })] })] }), _jsxs("div", { className: "document-header__actions", children: [activePanel === "mapping" && (_jsxs("button", { className: "button button--primary analysis-header-button", disabled: mapping.status === "running", onClick: onAnalyze, type: "button", children: [_jsx(SparklesIcon, {}), mapping.status === "completed" ? "Recartographier" : "Cartographier"] })), _jsx("button", { "aria-label": "Fermer le document", className: "icon-button icon-button--quiet", onClick: onClose, title: "Fermer le document", type: "button", children: _jsx(CloseIcon, {}) })] })] }), activePanel === "review" && mappingCompleted && reviewQuestions.length > 0 ? (_jsx(QuestionReview, { currentIndex: reviewIndex, currentPage: currentPage, documentMap: completedMap, exporting: exporting, illustrationAssets: illustrationGeneration.assets, illustrationPlan: illustrationPlan, onCurrentIndexChange: handleReviewIndexChange, onCurrentPageChange: onPageChange, onExport: () => void handleReviewExport(), onQuestionChange: handleReviewQuestionChange, onResetZoom: onResetZoom, onZoomIn: onZoomIn, onZoomOut: onZoomOut, pdf: pdf, questions: reviewQuestions, zoom: zoom })) : (_jsxs(_Fragment, { children: [_jsx(PdfToolbar, { currentPage: currentPage, onPageChange: onPageChange, onResetZoom: onResetZoom, onZoomIn: onZoomIn, onZoomOut: onZoomOut, pageCount: pdf.pageCount, zoom: zoom }), _jsxs("div", { className: `viewer-layout${showSidePanel ? " viewer-layout--with-mapping" : ""}`, children: [_jsxs("main", { className: "page-workspace", children: [renderError !== null && (_jsxs("div", { className: "inline-error", role: "alert", children: ["Une erreur est survenue pendant le rendu de la page : ", renderError] })), _jsx("div", { className: "page-stage", children: _jsx(PdfPageCanvas, { document: pdf.document, drawRole: isDrawing && activePanel === "mapping" ? drawingRole : null, onOverlaySelect: extraction.runStatus === "running" || illustrationGeneration.status === "running" ? undefined : onSelectRegion, onRegionAdd: extraction.runStatus === "running" || illustrationGeneration.status === "running" ? undefined : handleRegionAdd, onRegionChange: activePanel === "mapping" && extraction.runStatus !== "running" && illustrationGeneration.status !== "running" ? onUpdateRegionBbox : undefined, onRenderError: handleRenderError, overlays: overlays, pageNumber: currentPage, scale: zoom }) })] }), showSidePanel && (_jsx("div", { className: "side-panel-shell", children: activePanel === "preparing" ? (_jsx(PreparationPanel, { batching: batching, error: preparationError, onRetry: () => void handleValidateMapping() })) : activePanel === "extraction" && mappingCompleted ? (_jsx(ExtractionPanel, { documentMap: completedMap, extraction: extraction, onCancel: onCancelExtraction, onClear: onClearExtraction, onExtractAll: onExtractAll, onExtractBatch: onExtractBatch, onSelectSegment: onSelectSegment, plan: batching.plan })) : activePanel === "illustrations" && mappingCompleted ? (_jsx(IllustrationPanel, { generation: illustrationGeneration, onCancel: onCancelIllustrationGeneration, onClear: onClearIllustrations, onDownload: onDownloadIllustration, onGenerateAll: onGenerateAllIllustrations, onGenerateOne: onGenerateIllustration, onPageChange: onPageChange, onSelectSegment: onSelectSegment, plan: illustrationPlan })) : (_jsx(MappingPanel, { currentPage: currentPage, drawingRole: drawingRole, isDrawing: isDrawing, mapping: mapping, onAnalyze: onAnalyze, onCancel: onCancelMapping, onDeleteRegion: onDeleteRegion, onDeleteSegment: onDeleteSegment, onDrawingRoleChange: setDrawingRole, onSelectRegion: onSelectRegion, onSelectSegment: onSelectSegment, onToggleDrawing: () => setIsDrawing((active) => !active), onUpdateRegionRole: onUpdateRegionRole, onValidate: () => void handleValidateMapping() })) }))] })] }))] }));
}
