import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSegmentDisplayName } from "../domain/documentMap.js";
import { nextChoiceId, reviewQuestionIssues } from "../domain/review.js";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ImageIcon, MinusIcon, PlusIcon, TrashIcon, WarningIcon } from "./Icons.js";
import { PdfPageCanvas } from "./PdfPageCanvas.js";
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
        default: return "Non disponible";
    }
}
export function QuestionReview({ pdf, documentMap, questions, currentIndex, currentPage, zoom, illustrationPlan, illustrationAssets, exporting, onCurrentIndexChange, onCurrentPageChange, onQuestionChange, onZoomIn, onZoomOut, onResetZoom, onExport }) {
    const [renderError, setRenderError] = useState(null);
    const question = questions[currentIndex];
    const total = questions.length;
    const validatedCount = questions.filter((entry) => entry.validated).length;
    const allValidated = total > 0 && validatedCount === total;
    const validationIssues = question === undefined ? [] : reviewQuestionIssues(question);
    const canValidate = validationIssues.length === 0;
    const isLast = currentIndex === total - 1;
    const segmentInfo = useMemo(() => {
        if (question === undefined)
            return null;
        const segmentIndex = documentMap.question_segments.findIndex((segment) => segment.temporary_id === question.segmentId);
        const segment = segmentIndex >= 0 ? documentMap.question_segments[segmentIndex] : undefined;
        return segment === undefined ? null : { segment, segmentIndex };
    }, [documentMap.question_segments, question]);
    const sourcePages = useMemo(() => {
        if (question === undefined)
            return [];
        const pages = new Set(question.sourcePages);
        segmentInfo?.segment.page_regions.forEach((region) => pages.add(region.page));
        return [...pages].sort((left, right) => left - right);
    }, [question, segmentInfo]);
    useEffect(() => {
        if (question === undefined || sourcePages.length === 0)
            return;
        if (!sourcePages.includes(currentPage))
            onCurrentPageChange(sourcePages[0] ?? 1);
        setRenderError(null);
    }, [currentPage, onCurrentPageChange, question, sourcePages]);
    const overlays = useMemo(() => {
        if (segmentInfo === null)
            return [];
        return segmentInfo.segment.page_regions
            .filter((region) => region.page === currentPage)
            .map((region) => ({
            id: region.client_id,
            regionId: region.client_id,
            segmentId: segmentInfo.segment.temporary_id,
            label: getSegmentDisplayName(segmentInfo.segment, segmentInfo.segmentIndex),
            role: region.role,
            bbox: region.bbox,
            selected: false,
            segmentSelected: true
        }));
    }, [currentPage, segmentInfo]);
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
        changeQuestion({ correctChoiceIds, correctAnswerOrigin: "provided_by_user" });
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
        changeQuestion({
            choices: question.choices.filter((choice) => choice.id !== choiceId),
            correctChoiceIds: question.correctChoiceIds.filter((id) => id !== choiceId),
            correctAnswerOrigin: question.correctChoiceIds.includes(choiceId)
                ? "provided_by_user"
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
    if (question === undefined) {
        return (_jsx("div", { className: "review-empty-state", children: _jsx("strong", { children: "Aucune question extraite" }) }));
    }
    return (_jsxs("section", { className: "question-review", "aria-label": "R\u00E9vision des questions", children: [_jsxs("header", { className: "question-review__header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Phase 7 \u00B7 R\u00E9vision" }), _jsxs("h2", { children: ["Question ", currentIndex + 1, " sur ", total] }), _jsxs("p", { children: [validatedCount, " question", validatedCount > 1 ? "s" : "", " valid\u00E9e", validatedCount > 1 ? "s" : ""] })] }), _jsx("div", { className: "question-review__header-actions", children: _jsxs("label", { className: `review-validation-toggle${question.validated ? " review-validation-toggle--checked" : ""}`, children: [_jsx("input", { checked: question.validated, disabled: !canValidate && !question.validated, onChange: (event) => onQuestionChange({ ...question, validated: event.target.checked }), type: "checkbox" }), _jsx(CheckIcon, {}), " Question valid\u00E9e"] }) })] }), _jsx("div", { className: "question-review__progress", "aria-hidden": "true", children: _jsx("span", { style: { width: `${((currentIndex + 1) / total) * 100}%` } }) }), _jsxs("div", { className: "question-review__columns", children: [_jsxs("section", { className: "question-source-column", "aria-label": "Document PDF source", children: [_jsxs("header", { className: "question-column-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Source" }), _jsx("h3", { children: "PDF de la question" })] }), _jsxs("div", { className: "review-zoom-controls", children: [_jsx("button", { "aria-label": "R\u00E9duire", className: "icon-button", onClick: onZoomOut, type: "button", children: _jsx(MinusIcon, {}) }), _jsxs("button", { className: "review-zoom-value", onClick: onResetZoom, type: "button", children: [Math.round(zoom * 100), " %"] }), _jsx("button", { "aria-label": "Agrandir", className: "icon-button", onClick: onZoomIn, type: "button", children: _jsx(PlusIcon, {}) })] })] }), _jsx("div", { className: "review-page-tabs", "aria-label": "Pages sources", children: sourcePages.map((page) => (_jsxs("button", { "aria-current": page === currentPage ? "page" : undefined, className: page === currentPage ? "review-page-tab review-page-tab--active" : "review-page-tab", onClick: () => onCurrentPageChange(page), type: "button", children: ["Page ", page] }, page))) }), renderError !== null && _jsx("div", { className: "inline-error", role: "alert", children: renderError }), _jsx("div", { className: "question-source-stage", children: _jsx(PdfPageCanvas, { className: "question-source-canvas", document: pdf.document, onRenderError: setRenderError, overlays: overlays, pageNumber: currentPage, scale: zoom }) })] }), _jsxs("section", { className: "question-editor-column", "aria-label": "Contenu \u00E9ditable de la question", children: [_jsxs("header", { className: "question-column-header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Contenu extrait" }), _jsx("h3", { children: question.id })] }), _jsxs("span", { className: "review-confidence", children: ["Confiance ", Math.round(question.confidence * 100), " %"] })] }), _jsxs("div", { className: "question-form", children: [_jsxs("label", { className: "question-field question-field--compact", children: [_jsx("span", { children: "Type de question" }), _jsxs("select", { onChange: (event) => {
                                                    const type = event.target.value;
                                                    changeQuestion({
                                                        type,
                                                        correctChoiceIds: isSingleAnswer(type)
                                                            ? question.correctChoiceIds.slice(0, 1)
                                                            : question.correctChoiceIds
                                                    });
                                                }, value: question.type, children: [_jsx("option", { value: "single_choice", children: "Choix unique" }), _jsx("option", { value: "multiple_choice", children: "Choix multiples" }), _jsx("option", { value: "true_false", children: "Vrai ou faux" })] })] }), _jsxs("label", { className: "question-field", children: [_jsxs("span", { children: ["Titre ", _jsx("small", { children: originLabel(question.titleOrigin) })] }), _jsx("input", { onChange: (event) => changeQuestion({ title: event.target.value, titleOrigin: "provided_by_user" }), placeholder: "Titre de la question", type: "text", value: question.title })] }), _jsxs("label", { className: "question-field", children: [_jsxs("span", { children: ["\u00C9nonc\u00E9 ", _jsx("small", { children: "Markdown et LaTeX autoris\u00E9s" })] }), _jsx("textarea", { className: "question-statement-input", onChange: (event) => changeQuestion({ statement: event.target.value }), rows: 8, value: question.statement })] }), questionAssets.length > 0 && (_jsxs("section", { className: "review-assets review-assets--prominent", "aria-label": "Illustrations extraites de la question", children: [_jsxs("h4", { children: [_jsx(ImageIcon, {}), " Illustrations extraites"] }), _jsx("div", { className: "review-assets__grid", children: questionAssets.map(({ candidate, asset }) => (_jsxs("article", { children: [asset !== undefined ? (_jsx("img", { alt: candidate.altText, src: asset.previewUrl })) : (_jsxs("div", { className: "review-asset-placeholder", children: [_jsx(ImageIcon, {}), _jsx("span", { children: "Illustration indisponible" })] })), _jsxs("div", { children: [_jsx("strong", { children: candidate.altText }), _jsxs("span", { children: ["Page ", candidate.sourcePage, " \u00B7 ", candidate.role === "essential" ? "essentielle" : "décorative"] })] })] }, candidate.id))) })] })), _jsxs("fieldset", { className: "choice-editor", children: [_jsx("legend", { children: "Propositions et r\u00E9ponses correctes" }), _jsx("div", { className: "choice-editor__list", children: question.choices.map((choice, index) => {
                                                    const checked = question.correctChoiceIds.includes(choice.id);
                                                    return (_jsxs("div", { className: `choice-editor__row${checked ? " choice-editor__row--correct" : ""}`, children: [_jsxs("label", { className: "choice-correct-control", title: "R\u00E9ponse correcte", children: [_jsx("input", { checked: checked, name: isSingleAnswer(question.type) ? `correct-${question.id}` : undefined, onChange: () => toggleCorrectChoice(choice.id), type: isSingleAnswer(question.type) ? "radio" : "checkbox" }), _jsx("span", { children: String.fromCharCode(65 + index) })] }), _jsx("input", { "aria-label": `Proposition ${index + 1}`, onChange: (event) => changeChoice(choice.id, event.target.value), type: "text", value: choice.content }), _jsxs("div", { className: "choice-editor__actions", children: [_jsx("button", { "aria-label": "Monter", disabled: index === 0, onClick: () => moveChoice(choice.id, -1), type: "button", children: "\u2191" }), _jsx("button", { "aria-label": "Descendre", disabled: index === question.choices.length - 1, onClick: () => moveChoice(choice.id, 1), type: "button", children: "\u2193" }), _jsx("button", { "aria-label": "Supprimer", disabled: question.choices.length <= 2, onClick: () => deleteChoice(choice.id), type: "button", children: _jsx(TrashIcon, {}) })] })] }, choice.id));
                                                }) }), _jsxs("button", { className: "button button--secondary button--small", onClick: addChoice, type: "button", children: [_jsx(PlusIcon, {}), " Ajouter une proposition"] })] }), _jsxs("label", { className: "question-field question-field--compact", children: [_jsx("span", { children: "Origine de la r\u00E9ponse correcte" }), _jsxs("select", { onChange: (event) => {
                                                    const correctAnswerOrigin = event.target.value;
                                                    changeQuestion({
                                                        correctAnswerOrigin,
                                                        correctChoiceIds: correctAnswerOrigin === "not_available" ? [] : question.correctChoiceIds
                                                    });
                                                }, value: question.correctAnswerOrigin, children: [_jsx("option", { value: "explicit_in_document", children: "Pr\u00E9sente dans le document" }), _jsx("option", { value: "inferred_by_model", children: "D\u00E9duite par le mod\u00E8le" }), _jsx("option", { value: "provided_by_user", children: "Fournie par l\u2019utilisateur" }), _jsx("option", { value: "not_available", children: "Non disponible" })] })] }), _jsxs("label", { className: "question-field", children: [_jsxs("span", { children: ["Feedback p\u00E9dagogique ", _jsx("small", { children: originLabel(question.feedbackOrigin) })] }), _jsx("textarea", { onChange: (event) => changeQuestion({ feedback: event.target.value, feedbackOrigin: "provided_by_user" }), placeholder: "Explication de la r\u00E9ponse et des erreurs fr\u00E9quentes", required: true, rows: 6, value: question.feedback })] }), validationIssues.length > 0 && (_jsxs("section", { className: "review-warnings review-warnings--blocking", "aria-label": "Erreurs de validation", children: [_jsxs("h4", { children: [_jsx(WarningIcon, {}), " Corrections n\u00E9cessaires avant validation"] }), _jsx("ul", { children: validationIssues.map((issue) => _jsx("li", { children: issue }, issue)) })] })), question.warnings.length > 0 && (_jsxs("section", { className: "review-warnings", "aria-label": "Avertissements", children: [_jsxs("h4", { children: [_jsx(WarningIcon, {}), " Points \u00E0 v\u00E9rifier"] }), _jsx("ul", { children: question.warnings.map((warning) => _jsx("li", { children: warning }, warning)) })] }))] })] })] }), _jsxs("footer", { className: "question-review__navigation", children: [_jsxs("button", { className: "button button--secondary", disabled: currentIndex === 0, onClick: () => onCurrentIndexChange(currentIndex - 1), type: "button", children: [_jsx(ChevronLeftIcon, {}), " Pr\u00E9c\u00E9dente"] }), _jsxs("div", { className: "review-navigation-status", children: [_jsxs("span", { children: [currentIndex + 1, " / ", total] }), _jsx("strong", { children: question.validated ? "Validée" : "À valider" })] }), !isLast ? (_jsxs("button", { className: "button button--primary", onClick: () => onCurrentIndexChange(currentIndex + 1), type: "button", children: ["Suivante ", _jsx(ChevronRightIcon, {})] })) : (_jsxs("button", { className: "button button--primary button--export", disabled: !allValidated || exporting, onClick: onExport, type: "button", children: [_jsx(DownloadIcon, {}), " ", exporting ? "Préparation…" : "Exporter le ZIP"] }))] }), isLast && !allValidated && (_jsxs("p", { className: "review-export-hint", role: "status", children: ["Validez encore ", total - validatedCount, " question", total - validatedCount > 1 ? "s" : "", " pour activer l\u2019export."] }))] }));
}
