import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon, ResetIcon, SparklesIcon } from "./Icons.js?v=7.5.5";
export function PdfToolbar({ currentPage, pageCount, zoom, onPageChange, onZoomIn, onZoomOut, onResetZoom, onAnalyze }) {
    const [pageInput, setPageInput] = useState(String(currentPage));
    useEffect(() => {
        setPageInput(String(currentPage));
    }, [currentPage]);
    const commitPage = () => {
        const value = Number.parseInt(pageInput, 10);
        if (Number.isFinite(value)) {
            onPageChange(value);
        }
        else {
            setPageInput(String(currentPage));
        }
    };
    return (_jsxs("div", { className: "pdf-toolbar", role: "toolbar", "aria-label": "Commandes du document PDF", children: [_jsxs("div", { className: "toolbar-group", children: [_jsx("button", { "aria-label": "Page pr\u00E9c\u00E9dente", className: "icon-button", disabled: currentPage <= 1, onClick: () => onPageChange(currentPage - 1), title: "Page pr\u00E9c\u00E9dente (\u2190)", type: "button", children: _jsx(ChevronLeftIcon, {}) }), _jsxs("label", { className: "page-control", children: [_jsx("span", { className: "visually-hidden", children: "Num\u00E9ro de page" }), _jsx("input", { "aria-label": "Num\u00E9ro de page", inputMode: "numeric", max: pageCount, min: 1, onBlur: commitPage, onChange: (event) => setPageInput(event.currentTarget.value.replace(/[^0-9]/g, "")), onKeyDown: (event) => {
                                    if (event.key === "Enter") {
                                        commitPage();
                                        event.currentTarget.blur();
                                    }
                                }, value: pageInput }), _jsxs("span", { children: ["sur ", pageCount] })] }), _jsx("button", { "aria-label": "Page suivante", className: "icon-button", disabled: currentPage >= pageCount, onClick: () => onPageChange(currentPage + 1), title: "Page suivante (\u2192)", type: "button", children: _jsx(ChevronRightIcon, {}) })] }), _jsx("div", { className: "toolbar-divider", "aria-hidden": "true" }), _jsxs("div", { className: "toolbar-group", children: [_jsx("button", { "aria-label": "R\u00E9duire le zoom", className: "icon-button", onClick: onZoomOut, title: "R\u00E9duire le zoom (-)", type: "button", children: _jsx(MinusIcon, {}) }), _jsxs("output", { className: "zoom-value", "aria-label": "Niveau de zoom", children: [Math.round(zoom * 100), " %"] }), _jsx("button", { "aria-label": "Augmenter le zoom", className: "icon-button", onClick: onZoomIn, title: "Augmenter le zoom (+)", type: "button", children: _jsx(PlusIcon, {}) }), _jsx("button", { "aria-label": "R\u00E9initialiser le zoom", className: "icon-button", onClick: onResetZoom, title: "R\u00E9initialiser le zoom (0)", type: "button", children: _jsx(ResetIcon, {}) })] }), onAnalyze !== undefined && (_jsxs("button", { className: "button button--primary pdf-toolbar__primary-action", onClick: onAnalyze, type: "button", children: [_jsx(SparklesIcon, {}), " Cartographier"] }))] }));
}
