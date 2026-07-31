export const INITIAL_PROJECT_STATE = {
    status: "empty",
    pdf: null,
    currentPage: 1,
    zoom: 1,
    error: null
};
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;
export function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
export function projectReducer(state, action) {
    switch (action.type) {
        case "LOAD_STARTED":
            return {
                ...INITIAL_PROJECT_STATE,
                status: "loading"
            };
        case "LOAD_SUCCEEDED":
            return {
                status: "pdf_loaded",
                pdf: action.pdf,
                currentPage: 1,
                zoom: 1,
                error: null
            };
        case "LOAD_FAILED":
            return {
                ...INITIAL_PROJECT_STATE,
                status: "error",
                error: action.error
            };
        case "SET_PAGE": {
            if (state.pdf === null) {
                return state;
            }
            return {
                ...state,
                currentPage: clamp(Math.round(action.page), 1, state.pdf.pageCount)
            };
        }
        case "SET_ZOOM":
            return {
                ...state,
                zoom: clamp(action.zoom, MIN_ZOOM, MAX_ZOOM)
            };
        case "RESET":
            return INITIAL_PROJECT_STATE;
    }
}
