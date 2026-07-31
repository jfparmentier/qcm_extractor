import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { getDocumentTypeLabel, getQuestionTypeLabel, getSegmentDisplayName } from "../domain/documentMap.js";
import { CheckIcon, ImageIcon, SparklesIcon, StopIcon, WarningIcon } from "./Icons.js";
function formatElapsed(startedAt, now) {
    if (startedAt === null) {
        return "";
    }
    const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s` : `${seconds} s`;
}
function formatTokens(value) {
    return value === null ? "—" : new Intl.NumberFormat("fr-FR").format(value);
}
function getRunningStatusLabel(mapping) {
    switch (mapping.progress?.providerStatus) {
        case "uploading":
            return "Transmission sécurisée du PDF";
        case "queued":
            return "Analyse placée en file d’attente";
        case "in_progress":
            return "Analyse du document par le LLM";
        default:
            return "Initialisation de l’analyse";
    }
}
export function MappingPanel({ mapping, onAnalyze, onCancel, onSelectSegment }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (mapping.status !== "running") {
            return undefined;
        }
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [mapping.status]);
    const selectedIndex = useMemo(() => mapping.data?.question_segments.findIndex((segment) => segment.temporary_id === mapping.selectedSegmentId) ?? -1, [mapping.data, mapping.selectedSegmentId]);
    if (mapping.status === "running") {
        return (_jsxs("aside", { className: "mapping-panel mapping-panel--status", "aria-live": "polite", "aria-busy": "true", children: [_jsx("div", { className: "mapping-status-icon mapping-status-icon--running", children: _jsx("span", { className: "loading-spinner loading-spinner--small", "aria-hidden": "true" }) }), _jsx("span", { className: "eyebrow", children: "Premi\u00E8re passe" }), _jsx("h2", { children: "Cartographie du document" }), _jsx("p", { children: "Le proxy démarre une tâche asynchrone, puis le navigateur interroge régulièrement son état. Cette méthode évite les coupures des hébergements PHP pendant les analyses longues." }), _jsx("div", { className: "mapping-progress", "aria-hidden": "true", children: _jsx("span", {}) }), _jsxs("dl", { className: "mapping-facts", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u00C9tat" }), _jsx("dd", { children: getRunningStatusLabel(mapping) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Temps \u00E9coul\u00E9" }), _jsx("dd", { children: formatElapsed(mapping.startedAt, now) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Contr\u00F4les d\u2019\u00E9tat" }), _jsx("dd", { children: mapping.progress?.pollCount ?? 0 })] })] }), _jsxs("button", { className: "button button--secondary", onClick: onCancel, type: "button", children: [_jsx(StopIcon, {}), " Annuler"] })] }));
    }
    if (mapping.status === "failed" && mapping.error !== null) {
        return (_jsxs("aside", { className: "mapping-panel mapping-panel--status", role: "alert", children: [_jsx("div", { className: "mapping-status-icon mapping-status-icon--error", children: _jsx(WarningIcon, {}) }), _jsx("span", { className: "eyebrow", children: "Cartographie interrompue" }), _jsx("h2", { children: mapping.error.message }), _jsx("p", { children: mapping.error.retryable
                        ? "La requête peut être relancée. Aucun résultat partiel n’a été conservé."
                        : "Vérifiez la configuration du proxy ou le document avant de relancer." }), (mapping.error.technicalDetails !== undefined || mapping.error.requestId !== null) && (_jsxs("details", { className: "mapping-error-details", children: [_jsx("summary", { children: "D\u00E9tails techniques" }), mapping.error.technicalDetails !== undefined && _jsx("code", { children: mapping.error.technicalDetails }), mapping.error.requestId !== null && _jsxs("code", { children: ["Requ\u00EAte : ", mapping.error.requestId] })] })), _jsxs("button", { className: "button button--primary", onClick: onAnalyze, type: "button", children: [_jsx(SparklesIcon, {}), " Relancer la cartographie"] })] }));
    }
    if (mapping.status !== "completed" || mapping.data === null) {
        return (_jsxs("aside", { className: "mapping-panel mapping-panel--status", children: [_jsx("div", { className: "mapping-status-icon", children: _jsx(SparklesIcon, {}) }), _jsx("span", { className: "eyebrow", children: "Premi\u00E8re passe" }), _jsx("h2", { children: "Localiser les QCM" }), _jsx("p", { children: "Lancez une analyse globale pour identifier les segments de questions et leurs pages sources avant l\u2019extraction d\u00E9taill\u00E9e." }), _jsxs("button", { className: "button button--primary", onClick: onAnalyze, type: "button", children: [_jsx(SparklesIcon, {}), " Cartographier le PDF"] })] }));
    }
    const { document, question_segments: segments } = mapping.data;
    return (_jsxs("aside", { className: "mapping-panel", "aria-label": "Cartographie du document", children: [_jsxs("div", { className: "mapping-panel__header", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Cartographie termin\u00E9e" }), _jsxs("h2", { children: [segments.length, " question", segments.length > 1 ? "s" : "", " d\u00E9tect\u00E9e", segments.length > 1 ? "s" : ""] })] }), _jsxs("span", { className: "mapping-complete-badge", children: [_jsx(CheckIcon, {}), " Pr\u00EAte"] })] }), _jsxs("dl", { className: "mapping-summary", children: [_jsxs("div", { children: [_jsx("dt", { children: "Document" }), _jsx("dd", { children: document.title || "Sans titre" })] }), _jsxs("div", { children: [_jsx("dt", { children: "Type" }), _jsx("dd", { children: getDocumentTypeLabel(document.document_type) })] }), _jsxs("div", { children: [_jsx("dt", { children: "Langue" }), _jsx("dd", { children: document.language })] })] }), document.warnings.length > 0 && (_jsxs("details", { className: "mapping-warnings", children: [_jsxs("summary", { children: [document.warnings.length, " avertissement", document.warnings.length > 1 ? "s" : ""] }), _jsx("ul", { children: document.warnings.map((warning) => _jsx("li", { children: warning }, warning)) })] })), _jsxs("div", { className: "segment-list-heading", children: [_jsx("span", { children: "Segments" }), _jsx("span", { children: selectedIndex >= 0 ? `${selectedIndex + 1} / ${segments.length}` : segments.length })] }), _jsxs("nav", { className: "segment-list", "aria-label": "Questions d\u00E9tect\u00E9es", children: [segments.length === 0 && (_jsx("p", { className: "segment-list__empty", children: "Aucun QCM n\u2019a \u00E9t\u00E9 identifi\u00E9 dans ce document." })), segments.map((segment, index) => {
                        const selected = segment.temporary_id === mapping.selectedSegmentId;
                        return (_jsxs("button", { "aria-current": selected ? "true" : undefined, className: `segment-card${selected ? " segment-card--selected" : ""}`, onClick: () => onSelectSegment(segment.temporary_id), type: "button", children: [_jsx("span", { className: "segment-card__index", children: index + 1 }), _jsxs("span", { className: "segment-card__body", children: [_jsx("strong", { children: getSegmentDisplayName(segment, index) }), _jsx("span", { children: getQuestionTypeLabel(segment.question_type_hint) }), _jsxs("span", { className: "segment-card__meta", children: ["Page", segment.question_pages.length > 1 ? "s" : "", " ", segment.question_pages.join(", "), segment.contains_essential_image && _jsxs(_Fragment, { children: [_jsx("span", { "aria-hidden": "true", children: " \u00B7 " }), _jsx(ImageIcon, {}), " Illustration"] })] }), segment.warnings.length > 0 && (_jsxs("span", { className: "segment-card__warning", children: [_jsx(WarningIcon, {}), " \u00C0 v\u00E9rifier"] }))] }), _jsxs("span", { className: "segment-card__confidence", title: "Confiance du mod\u00E8le", children: [Math.round(segment.confidence * 100), " %"] })] }, segment.temporary_id));
                    })] }), _jsxs("footer", { className: "mapping-panel__footer", children: [_jsxs("div", { className: "mapping-usage", children: [_jsxs("span", { children: ["Mod\u00E8le : ", mapping.meta?.model ?? "—"] }), _jsxs("span", { children: ["Jetons : ", formatTokens(mapping.meta?.usage.total_tokens ?? null)] })] }), _jsxs("button", { className: "button button--secondary button--full", onClick: onAnalyze, type: "button", children: [_jsx(SparklesIcon, {}), " Relancer l\u2019analyse"] })] })] }));
}
