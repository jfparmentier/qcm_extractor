import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "../domain/projectState.js?v=7.5.8";
import { getStatementRegionsForSegment, nextChoiceId, reviewQuestionIssues } from "../domain/review.js?v=7.5.8";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ImageIcon, MinusIcon, PlusIcon, TrashIcon, UploadIcon, WarningIcon } from "./Icons.js?v=7.5.8";
import { PdfPageCanvas } from "./PdfPageCanvas.js?v=7.5.8";
function isSingleAnswer(type) {
    return type === "single_choice" || type === "true_false";
}
function setUserEdited(question, patch) {
    return { ...question, ...patch, validated: false };
}
function originLabel(origin) {
    switch (origin) {
        case "explicit_in_document": return "Présent dans le document";
        case "generated_by_model": return "Généré par le modèle";
        case "inferred_by_model": return "Déduit par le modèle";
        case "provided_by_user": return "Modifié par l’utilisateur";
        default: return "";
    }
}
function focusForRegions(regions) {
    if (regions.length === 0)
        return null;
    const left = Math.min(...regions.map((region) => region.bbox.x));
    const top = Math.min(...regions.map((region) => region.bbox.y));
    const right = Math.max(...regions.map((region) => region.bbox.x + region.bbox.width));
    const bottom = Math.max(...regions.map((region) => region.bbox.y + region.bbox.height));
    const margin = 0.035;
    const x = Math.max(0, left - margin);
    const y = Math.max(0, top - margin);
    return {
        x,
        y,
        width: Math.min(1, right + margin) - x,
        height: Math.min(1, bottom + margin) - y
    };
}
export function QuestionReview({ pdf, documentMap, questions, currentIndex, currentPage, zoom, illustrationPlan, illustrationAssets, exporting, onCurrentIndexChange, onCurrentPageChange, onQuestionChange, onZoomChange, onExport, onDownloadIllustration, onReplaceIllustration }) {
    const [renderError, setRenderError] = useState(null);
    const [maximumSourceZoom, setMaximumSourceZoom] = useState(MAX_ZOOM);
    const [replacingAssetId, setReplacingAssetId] = useState(null);
    const reviewRootRef = useRef(null);
    const sourceStageRef = useRef(null);
    const editorColumnRef = useRef(null);
    const question = questions[currentIndex];
    const total = questions.length;
    const reviewProgress = total === 0 ? 0 : Math.round(((currentIndex + 1) / total) * 100);
    const validationIssues = question === undefined ? [] : reviewQuestionIssues(question);
    const isLast = currentIndex === total - 1;
    const currentSegmentId = question?.segmentId ?? null;
    const questionSourcePages = question?.sourcePages;
    const segmentInfo = useMemo(() => {
        if (currentSegmentId === null)
            return null;
        const segment = documentMap.question_segments.find((candidate) => candidate.temporary_id === currentSegmentId);
        return segment ?? null;
    }, [currentSegmentId, documentMap.question_segments]);
    const sourcePages = useMemo(() => {
        if (questionSourcePages === undefined)
            return [];
        const pages = new Set(questionSourcePages);
        segmentInfo?.page_regions.forEach((region) => pages.add(region.page));
        return [...pages].sort((left, right) => left - right);
    }, [questionSourcePages, segmentInfo]);
    const statementRegions = useMemo(() => currentSegmentId === null
        ? []
        : getStatementRegionsForSegment(documentMap, currentSegmentId), [currentSegmentId, documentMap]);
    useEffect(() => {
        if (question === undefined || sourcePages.length === 0)
            return;
        if (!sourcePages.includes(currentPage))
            onCurrentPageChange(sourcePages[0] ?? 1);
        setRenderError(null);
    }, [currentPage, onCurrentPageChange, question, sourcePages]);
    const sourceSlices = useMemo(() => {
        if (statementRegions.length > 0) {
            return statementRegions.map((region, index) => ({
                key: region.client_id,
                page: region.page,
                focusBbox: focusForRegions([region]),
                label: `Zone ${index + 1}`
            }));
        }
        const fallbackPages = sourcePages.length > 0 ? sourcePages : [currentPage];
        return fallbackPages.map((page) => ({
            key: `page-${page}`,
            page,
            focusBbox: focusForRegions(segmentInfo?.page_regions.filter((region) => region.page === page) ?? []),
            label: null
        }));
    }, [currentPage, segmentInfo, sourcePages, statementRegions]);
    useEffect(() => {
        const stage = sourceStageRef.current;
        if (stage === null)
            return;
        let disposed = false;
        const fitPdfToStage = async () => {
            const visibleWidths = await Promise.all(sourceSlices.map(async (slice) => {
                const page = await pdf.document.getPage(slice.page);
                return page.getViewport({ scale: 1 }).width * (slice.focusBbox?.width ?? 1);
            }));
            if (disposed)
                return;
            const styles = window.getComputedStyle(stage);
            const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
            const availableWidth = Math.max(1, stage.clientWidth - horizontalPadding);
            const widestVisiblePage = Math.max(1, ...visibleWidths);
            const maximumZoom = Math.min(MAX_ZOOM, availableWidth / widestVisiblePage);
            setMaximumSourceZoom(maximumZoom);
            if (maximumZoom >= MIN_ZOOM && zoom > maximumZoom)
                onZoomChange(maximumZoom);
        };
        const updatePdfFit = () => {
            void fitPdfToStage().catch(() => undefined);
        };
        const resizeObserver = new ResizeObserver(updatePdfFit);
        resizeObserver.observe(stage);
        updatePdfFit();
        return () => {
            disposed = true;
            resizeObserver.disconnect();
        };
    }, [onZoomChange, pdf.document, sourceSlices, zoom]);
    const effectiveZoom = Math.min(zoom, maximumSourceZoom);
    const questionAssets = useMemo(() => {
        if (question === undefined)
            return [];
        return illustrationPlan.candidates
            .filter((candidate) => candidate.questionId === question.id ||
            (candidate.questionId === null && candidate.segmentId === question.segmentId))
            .map((candidate) => ({ candidate, asset: illustrationAssets[candidate.id] }));
    }, [illustrationAssets, illustrationPlan.candidates, question]);
    const changeQuestion = useCallback((patch) => {
        if (question !== undefined)
            onQuestionChange(setUserEdited(question, patch));
    }, [onQuestionChange, question]);
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            editorColumnRef.current?.scrollTo({ top: 0, behavior: "auto" });
            sourceStageRef.current?.scrollTo({ top: 0, behavior: "auto" });
            reviewRootRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [currentIndex, question?.id]);
    const changeChoice = useCallback((choiceId, content) => {
        if (question === undefined)
            return;
        changeQuestion({
            choices: question.choices.map((choice) => choice.id === choiceId ? { ...choice, content } : choice)
        });
    }, [changeQuestion, question]);
    const toggleCorrectChoice = useCallback((choiceId) => {
        if (question === undefined)
            return;
        const selected = question.correctChoiceIds.includes(choiceId);
        const correctChoiceIds = isSingleAnswer(question.type)
            ? (selected ? [] : [choiceId])
            : (selected
                ? question.correctChoiceIds.filter((id) => id !== choiceId)
                : [...question.correctChoiceIds, choiceId]);
        changeQuestion({
            correctChoiceIds,
            correctAnswerOrigin: correctChoiceIds.length === 0 ? "not_available" : "provided_by_user"
        });
    }, [changeQuestion, question]);
    const addChoice = useCallback(() => {
        if (question === undefined)
            return;
        const choice = { id: nextChoiceId(question.choices), content: "" };
        changeQuestion({ choices: [...question.choices, choice] });
    }, [changeQuestion, question]);
    const deleteChoice = useCallback((choiceId) => {
        if (question === undefined || question.choices.length <= 2)
            return;
        const correctChoiceIds = question.correctChoiceIds.filter((id) => id !== choiceId);
        changeQuestion({
            choices: question.choices.filter((choice) => choice.id !== choiceId),
            correctChoiceIds,
            correctAnswerOrigin: correctChoiceIds.length === 0
                ? "not_available"
                : question.correctAnswerOrigin
        });
    }, [changeQuestion, question]);
    const moveChoice = useCallback((choiceId, direction) => {
        if (question === undefined)
            return;
        const current = question.choices.findIndex((choice) => choice.id === choiceId);
        const target = current + direction;
        if (current < 0 || target < 0 || target >= question.choices.length)
            return;
        const choices = [...question.choices];
        const [moved] = choices.splice(current, 1);
        if (moved === undefined)
            return;
        choices.splice(target, 0, moved);
        changeQuestion({ choices });
    }, [changeQuestion, question]);
    const moveToQuestion = useCallback((index) => {
        onCurrentIndexChange(index);
    }, [onCurrentIndexChange]);
    const replaceAsset = useCallback(async (candidateId, file) => {
        setReplacingAssetId(candidateId);
        try {
            await onReplaceIllustration(candidateId, file);
        }
        catch (error) {
            window.alert(`Le remplacement de l’image a échoué : ${error instanceof Error ? error.message : String(error)}`);
        }
        finally {
            setReplacingAssetId(null);
        }
    }, [onReplaceIllustration]);
    if (question === undefined) {
        return _jsx("div", { className: "review-empty-state", children: _jsx("strong", { children: "Aucune question extraite" }) });
    }
    return (_jsxs("section", { ref: reviewRootRef, className: "question-review", "aria-label": "R\u00E9vision des questions", children: [_jsxs("div", { className: "question-review__columns", children: [_jsxs("section", { className: "question-source-column", "aria-label": "Document PDF source", children: [_jsxs("header", { className: "question-column-header", children: [_jsxs("div", { className: "question-source-heading", children: [_jsx("span", { className: "eyebrow", children: "Source" }), _jsx("span", { children: statementRegions.length > 0
                                                    ? `${statementRegions.length} zone${statementRegions.length > 1 ? "s" : ""} d’énoncé`
                                                    : `${sourceSlices.length} page${sourceSlices.length > 1 ? "s" : ""}` })] }), _jsxs("div", { className: "review-zoom-controls", children: [_jsx("button", { "aria-label": "R\u00E9duire", className: "icon-button", onClick: () => onZoomChange(effectiveZoom - ZOOM_STEP), type: "button", children: _jsx(MinusIcon, {}) }), _jsxs("button", { className: "review-zoom-value", onClick: () => onZoomChange(Math.min(1, maximumSourceZoom)), type: "button", children: [Math.round(effectiveZoom * 100), " %"] }), _jsx("button", { "aria-label": "Agrandir", className: "icon-button", onClick: () => onZoomChange(Math.min(maximumSourceZoom, effectiveZoom + ZOOM_STEP)), type: "button", children: _jsx(PlusIcon, {}) })] })] }), renderError !== null && _jsx("div", { className: "inline-error", role: "alert", children: renderError }), _jsx("div", { ref: sourceStageRef, className: "question-source-stage", children: sourceSlices.map((slice) => (_jsxs("article", { className: "question-source-slice", children: [_jsxs("header", { className: "question-source-slice__header", children: [_jsx("strong", { children: slice.label ?? `Page ${slice.page}` }), slice.label !== null && _jsxs("span", { children: ["Page ", slice.page] })] }), _jsx(PdfPageCanvas, { className: "question-source-canvas", document: pdf.document, focusBbox: slice.focusBbox, onRenderError: setRenderError, pageNumber: slice.page, scale: effectiveZoom })] }, slice.key))) })] }), _jsxs("section", { ref: editorColumnRef, className: "question-editor-column", "aria-label": "Contenu \u00E9ditable de la question", children: [_jsxs("header", { className: "question-column-header question-review-editor-header", children: [_jsxs("div", { className: "question-review-editor-header__topline", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Contenu extrait" }), _jsxs("h3", { children: ["Question ", currentIndex + 1, " ", _jsxs("span", { children: ["sur ", total] })] })] }), _jsxs("span", { className: "mapping-position-badge", "aria-label": `${reviewProgress} % du parcours`, children: [reviewProgress, " %"] })] }), _jsx("div", { "aria-label": `Progression de la révision : question ${currentIndex + 1} sur ${total}`, "aria-valuemax": total, "aria-valuemin": 1, "aria-valuenow": currentIndex + 1, className: "question-review-column-progress", role: "progressbar", children: _jsx("span", { style: { width: `${reviewProgress}%` } }) })] }), _jsxs("div", { className: "question-form", children: [_jsxs("label", { className: "question-field question-field--compact", children: [_jsx("span", { children: "Type de question" }), _jsxs("select", { onChange: (event) => {
                                                    const type = event.target.value;
                                                    const correctChoiceIds = isSingleAnswer(type)
                                                        ? question.correctChoiceIds.slice(0, 1)
                                                        : question.correctChoiceIds;
                                                    changeQuestion({
                                                        type,
                                                        correctChoiceIds,
                                                        correctAnswerOrigin: correctChoiceIds.length === 0
                                                            ? "not_available"
                                                            : question.correctAnswerOrigin
                                                    });
                                                }, value: question.type, children: [_jsx("option", { value: "single_choice", children: "Choix unique" }), _jsx("option", { value: "multiple_choice", children: "Choix multiples" })] })] }), _jsxs("label", { className: "question-field", children: [_jsx("span", { children: "Titre" }), _jsx("input", { onChange: (event) => changeQuestion({ title: event.target.value, titleOrigin: "provided_by_user" }), placeholder: "Titre de la question", type: "text", value: question.title })] }), _jsxs("label", { className: "question-field", children: [_jsxs("span", { children: ["\u00C9nonc\u00E9 ", _jsx("small", { children: "Markdown et LaTeX autoris\u00E9s" })] }), _jsx("textarea", { className: "question-statement-input", onChange: (event) => changeQuestion({ statement: event.target.value }), rows: 8, value: question.statement })] }), questionAssets.length > 0 && (_jsxs("section", { className: "review-assets review-assets--prominent", "aria-label": "Illustrations extraites de la question", children: [_jsxs("h4", { children: [_jsx(ImageIcon, {}), " Illustrations extraites"] }), _jsx("div", { className: "review-assets__grid", children: questionAssets.map(({ candidate, asset }) => (_jsxs("article", { children: [asset !== undefined ? (_jsx("img", { alt: candidate.altText, src: asset.previewUrl })) : (_jsxs("div", { className: "review-asset-placeholder", children: [_jsx(ImageIcon, {}), _jsx("span", { children: "Illustration indisponible" })] })), _jsxs("div", { className: "review-asset-caption", children: [_jsxs("div", { className: "review-asset-details", children: [_jsx("strong", { children: candidate.altText }), _jsxs("span", { children: ["Page ", candidate.sourcePage, " \u00B7 ", candidate.role === "essential" ? "essentielle" : "décorative"] })] }), _jsxs("div", { className: "review-asset-actions", children: [_jsx("button", { "aria-label": `Télécharger l’illustration ${candidate.altText}`, className: "icon-button", disabled: asset === undefined || replacingAssetId !== null, onClick: () => onDownloadIllustration(candidate.id), title: "T\u00E9l\u00E9charger l\u2019image", type: "button", children: _jsx(DownloadIcon, {}) }), _jsx("input", { accept: "image/*", "aria-hidden": "true", id: `replace-asset-${candidate.id}`, onChange: (event) => {
                                                                                const file = event.target.files?.[0];
                                                                                event.target.value = "";
                                                                                if (file !== undefined)
                                                                                    void replaceAsset(candidate.id, file);
                                                                            }, tabIndex: -1, type: "file" }), _jsx("button", { "aria-label": `Remplacer l’illustration ${candidate.altText}`, className: "icon-button", disabled: replacingAssetId !== null, onClick: () => document.getElementById(`replace-asset-${candidate.id}`)?.click(), title: "Importer une image de remplacement", type: "button", children: _jsx(UploadIcon, {}) })] })] })] }, candidate.id))) })] })), _jsxs("fieldset", { className: "choice-editor", children: [_jsx("legend", { children: "Propositions et r\u00E9ponses correctes" }), _jsx("div", { className: "choice-editor__list", children: question.choices.map((choice, index) => {
                                                    const checked = question.correctChoiceIds.includes(choice.id);
                                                    return (_jsxs("div", { className: `choice-editor__row${checked ? " choice-editor__row--correct" : ""}`, children: [_jsxs("label", { className: "choice-correct-control", title: "R\u00E9ponse correcte", children: [_jsx("input", { checked: checked, name: isSingleAnswer(question.type) ? `correct-${question.id}` : undefined, onChange: () => toggleCorrectChoice(choice.id), type: isSingleAnswer(question.type) ? "radio" : "checkbox" }), _jsx("span", { children: String.fromCharCode(65 + index) })] }), _jsx("input", { "aria-label": `Proposition ${index + 1}`, onChange: (event) => changeChoice(choice.id, event.target.value), type: "text", value: choice.content }), _jsxs("div", { className: "choice-editor__actions", children: [_jsx("button", { "aria-label": "Monter", disabled: index === 0, onClick: () => moveChoice(choice.id, -1), type: "button", children: "\u2191" }), _jsx("button", { "aria-label": "Descendre", disabled: index === question.choices.length - 1, onClick: () => moveChoice(choice.id, 1), type: "button", children: "\u2193" }), _jsx("button", { "aria-label": "Supprimer", disabled: question.choices.length <= 2, onClick: () => deleteChoice(choice.id), type: "button", children: _jsx(TrashIcon, {}) })] })] }, choice.id));
                                                }) }), _jsxs("button", { className: "button button--secondary button--small", onClick: addChoice, type: "button", children: [_jsx(PlusIcon, {}), " Ajouter une proposition"] })] }), _jsxs("label", { className: "question-field", children: [_jsxs("span", { children: ["Feedback p\u00E9dagogique ", _jsx("small", { children: originLabel(question.feedbackOrigin) })] }), _jsx("textarea", { onChange: (event) => changeQuestion({ feedback: event.target.value, feedbackOrigin: "provided_by_user" }), placeholder: "Explication de la r\u00E9ponse et des erreurs fr\u00E9quentes", required: true, rows: 6, value: question.feedback })] }), validationIssues.length > 0 && (_jsxs("section", { className: "review-warnings", "aria-label": "Points \u00E0 v\u00E9rifier", children: [_jsxs("h4", { children: [_jsx(WarningIcon, {}), " Points \u00E0 v\u00E9rifier avant l\u2019export"] }), _jsx("ul", { children: validationIssues.map((issue) => _jsx("li", { children: issue }, issue)) })] }))] })] })] }), _jsxs("footer", { className: "question-review__navigation", children: [_jsxs("button", { className: "button button--secondary", disabled: currentIndex === 0, onClick: () => moveToQuestion(currentIndex - 1), type: "button", children: [_jsx(ChevronLeftIcon, {}), " Pr\u00E9c\u00E9dente"] }), !isLast ? (_jsxs("button", { className: "button button--primary", onClick: () => moveToQuestion(currentIndex + 1), type: "button", children: ["Suivante ", _jsx(ChevronRightIcon, {})] })) : (_jsxs("button", { className: "button button--primary button--export", disabled: exporting, onClick: onExport, type: "button", children: [_jsx(DownloadIcon, {}), " ", exporting ? "Préparation…" : "Exporter le ZIP"] }))] })] }));
}
