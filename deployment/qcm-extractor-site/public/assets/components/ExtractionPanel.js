import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo } from "react";
import { mergeExtractionResults } from "../domain/extraction.js";
import { CheckIcon, LayersIcon, ResetIcon, SparklesIcon, StopIcon, WarningIcon } from "./Icons.js";
function statusLabel(status) {
    switch (status) {
        case "preparing": return "Préparation…";
        case "uploading": return "Transmission…";
        case "queued": return "En attente…";
        case "in_progress": return "Analyse…";
        case "completed": return "Terminé";
        case "failed": return "Échec";
        case "cancelled": return "Annulé";
        default: return "À extraire";
    }
}
function statusClass(status) {
    if (["preparing", "uploading", "queued", "in_progress"].includes(status)) {
        return "batch-status batch-status--running";
    }
    if (status === "completed")
        return "batch-status batch-status--ready";
    if (status === "failed")
        return "batch-status batch-status--error";
    if (status === "cancelled")
        return "batch-status batch-status--warning";
    return "batch-status";
}
function extractionStageText(batchState) {
    if (batchState?.progress === null || batchState?.progress === undefined)
        return null;
    if (batchState.progress.providerStatus === "queued") {
        return `File fournisseur · interrogation ${batchState.progress.pollCount}`;
    }
    if (batchState.progress.providerStatus === "in_progress") {
        return `Analyse fournisseur · interrogation ${batchState.progress.pollCount}`;
    }
    return "Transmission du sous-PDF";
}
function batchQuestionCount(batchId, extraction) {
    return extraction.batches[batchId]?.result?.questions.length ?? 0;
}
export function ExtractionPanel({ documentMap, plan, extraction, onExtractAll, onExtractBatch, onCancel, onClear, onSelectSegment }) {
    const running = extraction.runStatus === "running";
    const completedResults = useMemo(() => Object.entries(extraction.batches).flatMap(([batchId, state]) => state.status === "completed" && state.result !== null && state.meta !== null
        ? [{ batchId, result: state.result, meta: state.meta }]
        : []), [extraction.batches]);
    const merged = useMemo(() => mergeExtractionResults(documentMap, completedResults), [completedResults, documentMap]);
    const plannedBatches = plan?.batches ?? [];
    const completedCount = plannedBatches.filter((batch) => extraction.batches[batch.id]?.status === "completed").length;
    const failedCount = plannedBatches.filter((batch) => extraction.batches[batch.id]?.status === "failed").length;
    const allCompleted = plannedBatches.length > 0 && completedCount === plannedBatches.length;
    return (_jsxs("aside", { className: "mapping-panel extraction-panel", "aria-label": "Seconde passe d\u2019extraction", children: [_jsxs("div", { className: "mapping-panel__header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Phase 5" }), _jsx("h2", { children: "Extraire les QCM" })] }), _jsxs("span", { className: "mapping-complete-badge", children: [_jsx(SparklesIcon, {}), " LLM"] })] }), plan === null ? (_jsxs("div", { className: "batch-empty-state", children: [_jsx(LayersIcon, {}), _jsx("strong", { children: "Aucun lot disponible" }), _jsx("span", { children: "La pr\u00E9paration automatique des lots doit \u00EAtre termin\u00E9e avant l\u2019extraction." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "batch-actions", children: [_jsxs("button", { className: "button button--primary", disabled: running || allCompleted || plannedBatches.length === 0, onClick: onExtractAll, type: "button", children: [allCompleted ? _jsx(CheckIcon, {}) : _jsx(SparklesIcon, {}), allCompleted ? "Extraction terminée" : "Extraire tous les lots"] }), running ? (_jsxs("button", { className: "button button--danger", onClick: onCancel, type: "button", children: [_jsx(StopIcon, {}), " Annuler"] })) : (_jsxs("button", { className: "button button--secondary", disabled: completedResults.length === 0 && failedCount === 0, onClick: onClear, type: "button", children: [_jsx(ResetIcon, {}), " Effacer"] }))] }), _jsxs("dl", { className: "batch-summary extraction-summary", children: [_jsxs("div", { children: [_jsx("dt", { children: "Lots termin\u00E9s" }), _jsxs("dd", { children: [completedCount, "/", plannedBatches.length] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Questions fusionn\u00E9es" }), _jsx("dd", { children: merged.questions.length })] }), _jsxs("div", { children: [_jsx("dt", { children: "Segments manquants" }), _jsx("dd", { children: merged.missingSegmentIds.length })] }), _jsxs("div", { children: [_jsx("dt", { children: "Lots en \u00E9chec" }), _jsx("dd", { children: failedCount })] })] }), merged.missingSegmentIds.length > 0 && completedResults.length > 0 && (_jsxs("div", { className: "extraction-missing", role: "status", children: [_jsxs("div", { children: [_jsx(WarningIcon, {}), _jsx("strong", { children: "Questions encore manquantes" })] }), _jsx("div", { className: "batch-card__segments", children: merged.missingSegmentIds.map((segmentId) => (_jsx("button", { onClick: () => onSelectSegment(segmentId), type: "button", children: segmentId }, segmentId))) })] })), _jsx("div", { className: "batch-list extraction-batch-list", "aria-label": "\u00C9tat des extractions", children: plannedBatches.map((batch) => {
                            const batchState = extraction.batches[batch.id];
                            const status = batchState?.status ?? "idle";
                            const progressText = extractionStageText(batchState);
                            const questionCount = batchQuestionCount(batch.id, extraction);
                            return (_jsxs("article", { className: "batch-card extraction-card", children: [_jsxs("header", { className: "batch-card__header", children: [_jsxs("div", { children: [_jsxs("strong", { children: ["Lot ", batch.sequence] }), _jsxs("span", { children: [batch.segmentIds.length, " segment", batch.segmentIds.length > 1 ? "s" : ""] })] }), _jsx("span", { className: statusClass(status), children: statusLabel(status) })] }), _jsxs("dl", { className: "batch-card__meta", children: [_jsxs("div", { children: [_jsx("dt", { children: "Tentatives" }), _jsx("dd", { children: batchState?.attempts ?? 0 })] }), _jsxs("div", { children: [_jsx("dt", { children: "Questions" }), _jsx("dd", { children: questionCount })] }), _jsxs("div", { children: [_jsx("dt", { children: "Jetons" }), _jsx("dd", { children: batchState?.meta?.usage.total_tokens ?? "—" })] })] }), progressText !== null && _jsx("div", { className: "extraction-progress-line", children: progressText }), batchState?.result?.warnings.map((warning) => (_jsxs("div", { className: "batch-card__warning", children: [_jsx(WarningIcon, {}), " ", warning] }, warning))), batchState?.error !== null && batchState?.error !== undefined && (_jsxs("div", { className: "batch-card__error", role: "alert", children: [_jsx("strong", { children: batchState.error.code }), _jsx("br", {}), batchState.error.message] })), _jsx("footer", { className: "batch-card__actions", children: _jsxs("button", { className: "button button--secondary", disabled: running, onClick: () => onExtractBatch(batch.id), type: "button", children: [_jsx(SparklesIcon, {}), " ", status === "completed" ? "Réextraire" : "Extraire ce lot"] }) })] }, batch.id));
                        }) }), merged.questions.length > 0 && (_jsxs("section", { className: "extraction-preview", "aria-label": "Aper\u00E7u des questions extraites", children: [_jsx("h3", { children: "Aper\u00E7u fusionn\u00E9" }), merged.questions.map((question) => (_jsxs("article", { children: [_jsxs("header", { children: [_jsx("strong", { children: question.id }), _jsx("button", { onClick: () => onSelectSegment(question.segment_id), type: "button", children: question.segment_id })] }), _jsx("p", { children: question.title.content || question.statement.slice(0, 180) }), _jsxs("small", { children: [question.choices.length, " proposition", question.choices.length > 1 ? "s" : "", " \u00B7 r\u00E9ponse ", question.correct_answer_origin.replaceAll("_", " ")] })] }, question.id)))] }))] }))] }));
}
