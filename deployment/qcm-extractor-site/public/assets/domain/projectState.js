import { clampNormalizedBoundingBox } from "./documentMap.js";
export const INITIAL_MAPPING_STATE = {
    status: "idle",
    data: null,
    meta: null,
    error: null,
    startedAt: null,
    selectedSegmentId: null,
    selectedRegionId: null,
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
function addPage(pages, page) {
    return [...new Set([...pages, page])].sort((left, right) => left - right);
}
function enrichSegmentMetadata(segment, region) {
    const questionPages = region.role === "question" ||
        region.role === "choices" ||
        region.role === "essential_image" ||
        region.role === "decorative_image" ||
        region.role === "context"
        ? addPage(segment.question_pages, region.page)
        : segment.question_pages;
    const answerPages = region.role === "answer"
        ? addPage(segment.answer_pages, region.page)
        : segment.answer_pages;
    const feedbackPages = region.role === "feedback"
        ? addPage(segment.feedback_pages, region.page)
        : segment.feedback_pages;
    return {
        ...segment,
        question_pages: questionPages,
        answer_pages: answerPages,
        feedback_pages: feedbackPages,
        contains_essential_image: segment.contains_essential_image || region.role === "essential_image"
    };
}
function updateSegment(documentMap, segmentId, updater) {
    return {
        ...documentMap,
        question_segments: documentMap.question_segments.map((segment) => segment.temporary_id === segmentId ? updater(segment) : segment)
    };
}
function selectedRegionForPage(mapping, page) {
    if (mapping.data === null || mapping.selectedRegionId === null) {
        return null;
    }
    const selectedRegion = mapping.data.question_segments
        .flatMap((segment) => segment.page_regions)
        .find((region) => region.client_id === mapping.selectedRegionId);
    return selectedRegion?.page === page ? mapping.selectedRegionId : null;
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
            const page = clamp(Math.round(action.page), 1, state.pdf.pageCount);
            return {
                ...state,
                currentPage: page,
                mapping: {
                    ...state.mapping,
                    selectedRegionId: selectedRegionForPage(state.mapping, page)
                }
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
                    selectedRegionId: null,
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
            const firstPage = firstSegment?.question_pages[0] ?? state.currentPage;
            const firstRegion = firstSegment?.page_regions.find((region) => region.page === firstPage)
                ?? firstSegment?.page_regions[0]
                ?? null;
            return {
                ...state,
                currentPage: firstRegion?.page ?? firstPage,
                mapping: {
                    status: "completed",
                    data: action.documentMap,
                    meta: action.meta,
                    error: null,
                    startedAt: null,
                    selectedSegmentId: firstSegment?.temporary_id ?? null,
                    selectedRegionId: firstRegion?.client_id ?? null,
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
                    selectedRegionId: null,
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
            const targetPage = segment.question_pages[0] ?? segment.page_regions[0]?.page ?? state.currentPage;
            const targetRegion = segment.page_regions.find((region) => region.page === targetPage)
                ?? segment.page_regions[0]
                ?? null;
            return {
                ...state,
                currentPage: targetRegion?.page ?? targetPage,
                mapping: {
                    ...state.mapping,
                    selectedSegmentId: action.segmentId,
                    selectedRegionId: targetRegion?.client_id ?? null
                }
            };
        }
        case "SELECT_REGION": {
            const segment = state.mapping.data?.question_segments.find((candidate) => candidate.temporary_id === action.segmentId);
            const region = segment?.page_regions.find((candidate) => candidate.client_id === action.regionId);
            if (segment === undefined || region === undefined) {
                return state;
            }
            return {
                ...state,
                currentPage: region.page,
                mapping: {
                    ...state.mapping,
                    selectedSegmentId: segment.temporary_id,
                    selectedRegionId: region.client_id
                }
            };
        }
        case "UPDATE_REGION_BBOX": {
            if (state.mapping.data === null) {
                return state;
            }
            const data = updateSegment(state.mapping.data, action.segmentId, (segment) => ({
                ...segment,
                page_regions: segment.page_regions.map((region) => region.client_id === action.regionId
                    ? {
                        ...region,
                        bbox: clampNormalizedBoundingBox(action.bbox),
                        origin: "user"
                    }
                    : region)
            }));
            return {
                ...state,
                mapping: {
                    ...state.mapping,
                    data,
                    selectedSegmentId: action.segmentId,
                    selectedRegionId: action.regionId
                }
            };
        }
        case "UPDATE_REGION_ROLE": {
            if (state.mapping.data === null) {
                return state;
            }
            const data = updateSegment(state.mapping.data, action.segmentId, (segment) => {
                const updatedRegions = segment.page_regions.map((region) => region.client_id === action.regionId
                    ? { ...region, role: action.role, origin: "user" }
                    : region);
                const updatedRegion = updatedRegions.find((region) => region.client_id === action.regionId);
                const withMetadata = updatedRegion === undefined
                    ? segment
                    : enrichSegmentMetadata({ ...segment, page_regions: updatedRegions }, updatedRegion);
                return {
                    ...withMetadata,
                    contains_essential_image: updatedRegions.some((region) => region.role === "essential_image")
                };
            });
            return {
                ...state,
                mapping: {
                    ...state.mapping,
                    data,
                    selectedSegmentId: action.segmentId,
                    selectedRegionId: action.regionId
                }
            };
        }
        case "ADD_REGION": {
            if (state.mapping.data === null) {
                return state;
            }
            const normalizedRegion = {
                ...action.region,
                bbox: clampNormalizedBoundingBox(action.region.bbox),
                origin: "user"
            };
            const data = updateSegment(state.mapping.data, action.segmentId, (segment) => enrichSegmentMetadata({
                ...segment,
                page_regions: [...segment.page_regions, normalizedRegion]
            }, normalizedRegion));
            return {
                ...state,
                currentPage: normalizedRegion.page,
                mapping: {
                    ...state.mapping,
                    data,
                    selectedSegmentId: action.segmentId,
                    selectedRegionId: normalizedRegion.client_id
                }
            };
        }
        case "DELETE_REGION": {
            if (state.mapping.data === null) {
                return state;
            }
            const data = updateSegment(state.mapping.data, action.segmentId, (segment) => {
                const pageRegions = segment.page_regions.filter((region) => region.client_id !== action.regionId);
                return {
                    ...segment,
                    page_regions: pageRegions,
                    contains_essential_image: pageRegions.some((region) => region.role === "essential_image")
                };
            });
            return {
                ...state,
                mapping: {
                    ...state.mapping,
                    data,
                    selectedSegmentId: action.segmentId,
                    selectedRegionId: state.mapping.selectedRegionId === action.regionId
                        ? null
                        : state.mapping.selectedRegionId
                }
            };
        }
        case "RESET":
            return INITIAL_PROJECT_STATE;
    }
}
