import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentMap } from "./documentMap";
import type { MappingProgress, ProxyResponseMeta } from "../api/proxyClient";

export type ProjectStatus = "empty" | "loading" | "pdf_loaded" | "error";
export type MappingStatus = "idle" | "running" | "completed" | "failed";

export interface LoadedPdf {
  readonly fileName: string;
  readonly fileSize: number;
  readonly bytes: ArrayBuffer;
  readonly document: PDFDocumentProxy;
  readonly pageCount: number;
  readonly title: string | null;
  readonly author: string | null;
}

export interface ProjectError {
  readonly code:
    | "INVALID_FILE_TYPE"
    | "FILE_TOO_LARGE"
    | "PDF_PASSWORD_REQUIRED"
    | "PDF_INVALID"
    | "PDF_LOAD_FAILED"
    | "PAGE_RENDER_FAILED";
  readonly message: string;
  readonly technicalDetails?: string;
}

export interface MappingError {
  readonly code: string;
  readonly message: string;
  readonly technicalDetails?: string;
  readonly retryable: boolean;
  readonly requestId: string | null;
}

export interface MappingState {
  readonly status: MappingStatus;
  readonly data: DocumentMap | null;
  readonly meta: ProxyResponseMeta | null;
  readonly error: MappingError | null;
  readonly startedAt: number | null;
  readonly selectedSegmentId: string | null;
  readonly progress: MappingProgress | null;
}

export interface ProjectState {
  readonly status: ProjectStatus;
  readonly pdf: LoadedPdf | null;
  readonly currentPage: number;
  readonly zoom: number;
  readonly error: ProjectError | null;
  readonly mapping: MappingState;
}

export const INITIAL_MAPPING_STATE: MappingState = {
  status: "idle",
  data: null,
  meta: null,
  error: null,
  startedAt: null,
  selectedSegmentId: null,
  progress: null
};

export const INITIAL_PROJECT_STATE: ProjectState = {
  status: "empty",
  pdf: null,
  currentPage: 1,
  zoom: 1,
  error: null,
  mapping: INITIAL_MAPPING_STATE
};

export type ProjectAction =
  | { readonly type: "LOAD_STARTED" }
  | { readonly type: "LOAD_SUCCEEDED"; readonly pdf: LoadedPdf }
  | { readonly type: "LOAD_FAILED"; readonly error: ProjectError }
  | { readonly type: "SET_PAGE"; readonly page: number }
  | { readonly type: "SET_ZOOM"; readonly zoom: number }
  | { readonly type: "MAPPING_STARTED"; readonly startedAt: number }
  | { readonly type: "MAPPING_PROGRESS"; readonly progress: MappingProgress }
  | {
      readonly type: "MAPPING_SUCCEEDED";
      readonly documentMap: DocumentMap;
      readonly meta: ProxyResponseMeta;
    }
  | { readonly type: "MAPPING_FAILED"; readonly error: MappingError }
  | { readonly type: "MAPPING_CANCELLED" }
  | { readonly type: "SELECT_SEGMENT"; readonly segmentId: string }
  | { readonly type: "RESET" };

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
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
      const segment = state.mapping.data?.question_segments.find(
        (candidate) => candidate.temporary_id === action.segmentId
      );
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
