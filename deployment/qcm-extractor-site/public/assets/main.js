import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js?v=7.6.1";
const rootElement = document.getElementById("root");
if (rootElement === null) {
    throw new Error("Élément racine #root introuvable.");
}
createRoot(rootElement).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
