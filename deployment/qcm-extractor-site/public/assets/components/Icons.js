import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function BaseIcon({ children, ...props }) {
    return (_jsx("svg", { "aria-hidden": "true", fill: "none", focusable: "false", height: "20", viewBox: "0 0 24 24", width: "20", ...props, children: children }));
}
export function UploadIcon(props) {
    return (_jsxs(BaseIcon, { ...props, children: [_jsx("path", { d: "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.8" }), _jsx("path", { d: "M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.8" })] }));
}
export function FileIcon(props) {
    return (_jsxs(BaseIcon, { ...props, children: [_jsx("path", { d: "M7 3.5h6.8L18.5 8v12.5H7z", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "1.8" }), _jsx("path", { d: "M13.5 3.8V8h4.3", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "1.8" }), _jsx("path", { d: "M9.5 12h6M9.5 15h6", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.6" })] }));
}
export function ChevronLeftIcon(props) {
    return (_jsx(BaseIcon, { ...props, children: _jsx("path", { d: "m14.5 5-7 7 7 7", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" }) }));
}
export function ChevronRightIcon(props) {
    return (_jsx(BaseIcon, { ...props, children: _jsx("path", { d: "m9.5 5 7 7-7 7", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" }) }));
}
export function MinusIcon(props) {
    return (_jsx(BaseIcon, { ...props, children: _jsx("path", { d: "M5 12h14", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" }) }));
}
export function PlusIcon(props) {
    return (_jsx(BaseIcon, { ...props, children: _jsx("path", { d: "M5 12h14M12 5v14", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" }) }));
}
export function ResetIcon(props) {
    return (_jsxs(BaseIcon, { ...props, children: [_jsx("path", { d: "M5.4 8.2A7 7 0 1 1 5 15", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "1.8" }), _jsx("path", { d: "M5.3 4.8v3.8h3.8", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.8" })] }));
}
export function CloseIcon(props) {
    return (_jsx(BaseIcon, { ...props, children: _jsx("path", { d: "m6 6 12 12M18 6 6 18", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" }) }));
}
export function WarningIcon(props) {
    return (_jsxs(BaseIcon, { ...props, children: [_jsx("path", { d: "M12 4 3.8 19h16.4z", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "1.8" }), _jsx("path", { d: "M12 9v4.5M12 16.7v.1", stroke: "currentColor", strokeLinecap: "round", strokeWidth: "2" })] }));
}
export function ShieldIcon(props) {
    return (_jsxs(BaseIcon, { ...props, children: [_jsx("path", { d: "M12 3.5 19 6v5.2c0 4.1-2.7 7.6-7 9.3-4.3-1.7-7-5.2-7-9.3V6z", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "1.8" }), _jsx("path", { d: "m8.8 12 2 2 4.4-4.5", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.8" })] }));
}
export function SparklesIcon(props) {
    return (_jsxs(BaseIcon, { ...props, children: [_jsx("path", { d: "m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2z", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "1.7" }), _jsx("path", { d: "m18.5 13 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7zM5.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z", stroke: "currentColor", strokeLinejoin: "round", strokeWidth: "1.5" })] }));
}
export function StopIcon(props) {
    return (_jsx(BaseIcon, { ...props, children: _jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2", stroke: "currentColor", strokeWidth: "1.8" }) }));
}
export function ImageIcon(props) {
    return (_jsxs(BaseIcon, { ...props, children: [_jsx("rect", { x: "3.5", y: "4.5", width: "17", height: "15", rx: "2", stroke: "currentColor", strokeWidth: "1.8" }), _jsx("circle", { cx: "9", cy: "9.5", r: "1.5", stroke: "currentColor", strokeWidth: "1.6" }), _jsx("path", { d: "m5.5 17 4.3-4.3 2.8 2.7 2.4-2.3 3.5 3.9", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "1.7" })] }));
}
export function CheckIcon(props) {
    return (_jsx(BaseIcon, { ...props, children: _jsx("path", { d: "m5 12.5 4.2 4.2L19 7", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2" }) }));
}
