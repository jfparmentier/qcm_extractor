import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
import { MAX_PDF_SIZE_BYTES } from "../pdf/loadPdf.js";
import { FileIcon, ShieldIcon, UploadIcon } from "./Icons.js";
export function FileDropZone({ disabled = false, onFileSelected }) {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const selectFirstFile = (files) => {
        const file = files?.item(0);
        if (file !== null && file !== undefined) {
            onFileSelected(file);
        }
    };
    return (_jsxs("section", { className: "welcome-panel", "aria-labelledby": "welcome-title", children: [_jsxs("div", { className: "welcome-copy", children: [_jsx("span", { className: "eyebrow", children: "Phase 1 \u00B7 Socle frontend" }), _jsx("h1", { id: "welcome-title", children: "Pr\u00E9parer un PDF pour l\u2019extraction de QCM" }), _jsx("p", { children: "Le document est charg\u00E9 et affich\u00E9 exclusivement dans votre navigateur. Aucun transfert r\u00E9seau n\u2019est effectu\u00E9 pendant cette phase." })] }), _jsxs("button", { className: `drop-zone${isDragging ? " drop-zone--active" : ""}`, disabled: disabled, onClick: () => inputRef.current?.click(), onDragEnter: (event) => {
                    event.preventDefault();
                    if (!disabled) {
                        setIsDragging(true);
                    }
                }, onDragLeave: (event) => {
                    event.preventDefault();
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setIsDragging(false);
                    }
                }, onDragOver: (event) => {
                    event.preventDefault();
                    if (event.dataTransfer !== null) {
                        event.dataTransfer.dropEffect = "copy";
                    }
                }, onDrop: (event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    if (!disabled) {
                        selectFirstFile(event.dataTransfer.files);
                    }
                }, type: "button", children: [_jsx("span", { className: "drop-zone__icon", children: _jsx(UploadIcon, {}) }), _jsx("span", { className: "drop-zone__title", children: "D\u00E9poser un fichier PDF" }), _jsx("span", { className: "drop-zone__separator", children: "ou" }), _jsxs("span", { className: "button button--primary", children: [_jsx(FileIcon, {}), " S\u00E9lectionner un fichier"] }), _jsxs("span", { className: "drop-zone__hint", children: ["PDF uniquement \u00B7 taille maximale ", Math.round(MAX_PDF_SIZE_BYTES / 1024 / 1024), " Mo"] })] }), _jsx("input", { ref: inputRef, accept: "application/pdf,.pdf", className: "visually-hidden", disabled: disabled, onChange: (event) => {
                    selectFirstFile(event.currentTarget.files);
                    event.currentTarget.value = "";
                }, type: "file" }), _jsxs("div", { className: "privacy-note", children: [_jsx(ShieldIcon, {}), _jsxs("div", { children: [_jsx("strong", { children: "Traitement local" }), _jsx("span", { children: "Le PDF reste en m\u00E9moire et dispara\u00EEt lorsque l\u2019onglet est ferm\u00E9." })] })] })] }));
}
