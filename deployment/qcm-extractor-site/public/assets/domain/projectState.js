export const INITIAL_MAPPING_STATE = {
    status: "idle",
    data: null,
    meta: null,
    error: null,
    startedAt: null,
    selectedSegmentId: null,
    progress: null
};
export const INITIAL_PROJECT_STATE = {
    status: "empty",
    pdf: null,
    currentPage: 1,
    zoom: 1,
    error: null,
    mapping: INITIAL_MAPPING_STATE
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
                error: null,
                mapping: INITIAL_MAPPING_STATE
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
        case "MAPPING_STARTED":
            return {
                ...state,
                mapping: {
                    status: "running",
                    data: null,
                    meta: null,
                    error: null,
                    startedAt: action.startedAt,
                    selectedSegmentId: null,
                    progress: { providerStatus: "uploading", pollCount: 0, requestId: null }
                }
            };
        case "MAPPING_PROGRESS":
            return {
                ...state,
                mapping: {
                    ...state.mapping,
                    progress: action.progress
                }
            };
        case "MAPPING_SUCCEEDED": {
            const firstSegment = action.documentMap.question_segments[0] ?? null;
            return {
                ...state,
                currentPage: firstSegment?.question_pages[0] ?? state.currentPage,
                mapping: {
                    status: "completed",
                    data: action.documentMap,
                    meta: action.meta,
                    error: null,
                    startedAt: null,
                    selectedSegmentId: firstSegment?.temporary_id ?? null,
                    progress: null
                }
            };
        }
        case "MAPPING_FAILED":
            return {
                ...state,
                mapping: {
                    status: "failed",
                    data: null,
                    meta: null,
                    error: action.error,
                    startedAt: null,
                    selectedSegmentId: null,
                    progress: null
                }
            };
        case "MAPPING_CANCELLED":
            return {
                ...state,
                mapping: INITIAL_MAPPING_STATE
            };
        case "SELECT_SEGMENT": {
            const segment = state.mapping.data?.question_segments.find((candidate) => candidate.temporary_id === action.segmentId);
            if (segment === undefined) {
                return state;
            }
            return {
                ...state,
                currentPage: segment.question_pages[0] ?? state.currentPage,
                mapping: {
                    ...state.mapping,
                    selectedSegmentId: action.segmentId
                }
            };
        }
        case "RESET":
            return INITIAL_PROJECT_STATE;
    }
}
