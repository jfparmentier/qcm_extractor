import type { PDFDocumentProxy } from "pdfjs-dist";

export type ProjectStatus = "empty" | "loading" | "pdf_loaded" | "error";

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

export interface ProjectState {
  readonly status: ProjectStatus;
  readonly pdf: LoadedPdf | null;
  readonly currentPage: number;
  readonly zoom: number;
  readonly error: ProjectError | null;
}

export const INITIAL_PROJECT_STATE: ProjectState = {
  status: "empty",
  pdf: null,
  currentPage: 1,
  zoom: 1,
  error: null
};

export type ProjectAction =
  | { readonly type: "LOAD_STARTED" }
  | { readonly type: "LOAD_SUCCEEDED"; readonly pdf: LoadedPdf }
  | { readonly type: "LOAD_FAILED"; readonly error: ProjectError }
  | { readonly type: "SET_PAGE"; readonly page: number }
  | { readonly type: "SET_ZOOM"; readonly zoom: number }
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
