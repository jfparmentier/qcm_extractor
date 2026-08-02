import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { mergeExtractionResults } from "../domain/extraction.js?v=7.5.1";
import { CheckIcon, LayersIcon, SparklesIcon, StopIcon, WarningIcon } from "./Icons.js?v=7.5.1";
function formatElapsed(startedAt, endedAt) {
    if (startedAt === null)
        return "—";
    const seconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0
        ? `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`
        : `${seconds} s`;
}
function isRunningStatus(status) {
    return ["preparing", "uploading", "queued", "in_progress"].includes(status);
}
function activeStatus(extraction) {
    const statuses = Object.values(extraction.batches).map((batch) => batch.status);
    for (const candidate of ["in_progress", "queued", "uploading", "preparing"]) {
        if (statuses.includes(candidate))
            return candidate;
    }
    return null;
}
function statusLabel(extraction, allCompleted, failedCount) {
    if (extraction.runStatus === "running") {
        switch (activeStatus(extraction)) {
            case "in_progress": return "Analyse des QCM par le LLM";
            case "queued": return "Analyse placée en file d’attente";
            case "uploading": return "Transmission sécurisée d’un sous-PDF";
            case "preparing": return "Préparation du prochain lot";
            default: return "Initialisation de l’extraction";
        }
    }
    if (allCompleted)
        return "Extraction terminée";
    if (failedCount > 0)
        return "Extraction incomplète";
    if (extraction.runStatus === "cancelled")
        return "Extraction annulée";
    return "Prête à démarrer";
}
function extractionStart(extraction) {
    if (extraction.startedAt !== null)
        return extraction.startedAt;
    const values = Object.values(extraction.batches)
        .map((batch) => batch.startedAt)
        .filter((value) => value !== null);
    return values.length > 0 ? Math.min(...values) : null;
}
function extractionEnd(extraction, now) {
    if (extraction.runStatus === "running")
        return now;
    const values = Object.values(extraction.batches)
        .map((batch) => batch.completedAt)
        .filter((value) => value !== null);
    return values.length > 0 ? Math.max(...values) : now;
}
export function ExtractionPanel({ documentMap, plan, extraction, onExtractAll, onCancel, onSelectSegment }) {
    const [now, setNow] = useState(Date.now());
    const running = extraction.runStatus === "running";
    useEffect(() => {
        setNow(Date.now());
        if (!running)
            return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [running]);
    const completedResults = useMemo(() => Object.entries(extraction.batches).flatMap(([batchId, state]) => state.status === "completed" && state.result !== null && state.meta !== null
        ? [{ batchId, result: state.result, meta: state.meta }]
        : []), [extraction.batches]);
    const merged = useMemo(() => mergeExtractionResults(documentMap, completedResults), [completedResults, documentMap]);
    const plannedBatches = plan?.batches ?? [];
    const completedCount = plannedBatches.filter((batch) => extraction.batches[batch.id]?.status === "completed").length;
    const failedBatches = plannedBatches.filter((batch) => extraction.batches[batch.id]?.status === "failed");
    const cancelledCount = plannedBatches.filter((batch) => extraction.batches[batch.id]?.status === "cancelled").length;
    const processedCount = completedCount + failedBatches.length + cancelledCount;
    const allCompleted = plannedBatches.length > 0 && completedCount === plannedBatches.length;
    const startedAt = extractionStart(extraction);
    const elapsed = formatElapsed(startedAt, extractionEnd(extraction, now));
    const currentStatus = statusLabel(extraction, allCompleted, failedBatches.length);
    const activeBatch = plannedBatches.find((batch) => isRunningStatus(extraction.batches[batch.id]?.status ?? "idle"));
    const activeProgress = activeBatch === undefined
        ? null
        : extraction.batches[activeBatch.id]?.progress ?? null;
    return (_jsxs("aside", { className: "mapping-panel extraction-panel", "aria-label": "Extraction des QCM", children: [_jsxs("div", { className: "mapping-panel__header", children: [_jsx("div", { children: _jsx("h2", { children: "Extraire les QCM" }) }), _jsxs("span", { className: "mapping-complete-badge", children: [_jsx(SparklesIcon, {}), " LLM"] })] }), plan === null ? (_jsxs("div", { className: "batch-empty-state", children: [_jsx(LayersIcon, {}), _jsx("strong", { children: "Aucun lot disponible" }), _jsx("span", { children: "La pr\u00E9paration automatique des lots doit \u00EAtre termin\u00E9e avant l\u2019extraction." })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: `mapping-status-icon${running ? " mapping-status-icon--running" : ""}`, children: running
                            ? _jsx("span", { className: "loading-spinner loading-spinner--small", "aria-hidden": "true" })
                            : allCompleted
                                ? _jsx(CheckIcon, {})
                                : failedBatches.length > 0
                                    ? _jsx(WarningIcon, {})
                                    : _jsx(SparklesIcon, {}) }), running && _jsx("div", { className: "mapping-progress", "aria-hidden": "true", children: _jsx("span", {}) }), _jsxs("dl", { className: "mapping-facts extraction-facts", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u00C9tat" }), _jsx("dd", { children: currentStatus })] }), _jsxs("div", { children: [_jsx("dt", { children: "Temps \u00E9coul\u00E9" }), _jsx("dd", { children: elapsed })] }), _jsxs("div", { children: [_jsx("dt", { children: "Lots trait\u00E9s" }), _jsxs("dd", { children: [processedCount, "/", plannedBatches.length] })] }), _jsxs("div", { children: [_jsx("dt", { children: "Questions extraites" }), _jsx("dd", { children: merged.questions.length })] }), activeProgress !== null && (_jsxs("div", { children: [_jsx("dt", { children: "Suivi" }), _jsxs("dd", { children: ["Interrogation ", activeProgress.pollCount] })] }))] }), failedBatches.length > 0 && (_jsxs("section", { className: "extraction-errors", role: "alert", children: [_jsxs("strong", { children: [_jsx(WarningIcon, {}), " ", failedBatches.length, " lot", failedBatches.length > 1 ? "s" : "", " en \u00E9chec"] }), _jsx("ul", { children: failedBatches.map((batch) => {
                                    const error = extraction.batches[batch.id]?.error;
                                    return _jsxs("li", { children: ["Lot ", batch.sequence, " : ", error?.message ?? "échec non détaillé"] }, batch.id);
                                }) })] })), merged.missingSegmentIds.length > 0 && completedResults.length > 0 && (_jsxs("div", { className: "extraction-missing", role: "status", children: [_jsxs("div", { children: [_jsx(WarningIcon, {}), _jsx("strong", { children: "Questions encore manquantes" })] }), _jsx("div", { className: "batch-card__segments", children: merged.missingSegmentIds.map((segmentId) => (_jsx("button", { onClick: () => onSelectSegment(segmentId), type: "button", children: segmentId }, segmentId))) })] })), _jsx("div", { className: "batch-actions extraction-actions", children: running ? (_jsxs("button", { className: "button button--danger", onClick: onCancel, type: "button", children: [_jsx(StopIcon, {}), " Annuler"] })) : (_jsxs("button", { className: "button button--primary", disabled: allCompleted || plannedBatches.length === 0, onClick: onExtractAll, type: "button", children: [_jsx(SparklesIcon, {}), " Extraire les QCM"] })) })] }))] }));
}
