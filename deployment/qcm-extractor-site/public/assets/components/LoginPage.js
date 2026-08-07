import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ShieldIcon } from "./Icons.js?v=7.6.1";
export function LoginPage({ checking, error, submitting, onSubmit }) {
    const [email, setEmail] = useState("");
    const busy = checking || submitting;
    return (_jsx("main", { className: "login-page", children: _jsxs("section", { className: "login-card", "aria-labelledby": "login-title", children: [_jsxs("div", { className: "login-card__heading", children: [_jsx("div", { className: "login-card__icon", children: _jsx(ShieldIcon, {}) }), _jsx("span", { className: "eyebrow", id: "login-title", children: "Acc\u00E8s r\u00E9serv\u00E9" })] }), _jsx("p", { children: "Entrez votre adresse email professionnelle pour acc\u00E9der \u00E0 l\u2019extracteur de QCM." }), _jsxs("form", { className: "login-form", onSubmit: (event) => {
                        event.preventDefault();
                        if (!busy)
                            onSubmit(email);
                    }, children: [_jsx("label", { htmlFor: "login-email", children: "Adresse email" }), _jsx("input", { autoComplete: "email", autoFocus: true, disabled: busy, id: "login-email", inputMode: "email", onChange: (event) => setEmail(event.target.value), placeholder: "prenom.nom@organisation.fr", required: true, type: "email", value: email }), error !== null && _jsx("div", { className: "login-error", role: "alert", children: error }), _jsx("button", { className: "button button--primary", disabled: busy || email.trim() === "", type: "submit", children: checking ? "Vérification de la session…" : submitting ? "Vérification…" : "Se connecter" })] })] }) }));
}
