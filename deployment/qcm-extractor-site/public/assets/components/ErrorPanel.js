import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { WarningIcon } from "./Icons.js?v=7.3.1";
export function ErrorPanel({ error, onRetry }) {
    return (_jsxs("section", { className: "error-panel", role: "alert", children: [_jsx("span", { className: "error-panel__icon", children: _jsx(WarningIcon, {}) }), _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Erreur de chargement" }), _jsx("h1", { children: error.message }), error.technicalDetails !== undefined && (_jsxs("details", { children: [_jsx("summary", { children: "D\u00E9tails techniques" }), _jsx("code", { children: error.technicalDetails })] })), _jsx("button", { className: "button button--primary", onClick: onRetry, type: "button", children: "S\u00E9lectionner un autre fichier" })] })] }));
}
