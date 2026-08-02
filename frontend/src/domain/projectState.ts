import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  clampNormalizedBoundingBox,
  type DocumentMap,
  type NormalizedBoundingBox,
  type PageRegion,
  type PageRegionRole,
  type QuestionSegment
} from "./documentMap";
import type { ExtractionProgress, MappingProgress, ProxyResponseMeta } from "../api/proxyClient";
import type { ExtractionBatchResult } from "./extraction";
import {
  DEFAULT_BATCH_SETTINGS,
  normalizeBatchSettings,
  type BatchPlan,
  type BatchSettings,
  type GeneratedBatchArtifact
} from "./batchPlan";

export type ProjectStatus = "empty" | "loading" | "pdf_loaded" | "error";
export type MappingStatus = "idle" | "running" | "completed" | "failed";
export type ExtractionRunStatus = "idle" | "running" | "completed" | "cancelled";
export type ExtractionBatchStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

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
  readonly selectedRegionId: string | null;
  readonly progress: MappingProgress | null;
}

export interface BatchPreparationState {
  readonly settings: BatchSettings;
  readonly plan: BatchPlan | null;
  readonly artifacts: Readonly<Record<string, GeneratedBatchArtifact>>;
  readonly activeBatchId: string | null;
  readonly errors: Readonly<Record<string, string>>;
}

export interface ExtractionSettings {
  readonly maxConcurrentBatches: number;
  readonly maxRetries: number;
}

export interface ExtractionBatchError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly requestId: string | null;
  readonly technicalDetails?: string;
}

export interface ExtractionBatchState {
  readonly status: ExtractionBatchStatus;
  readonly attempts: number;
  readonly progress: ExtractionProgress | null;
  readonly result: ExtractionBatchResult | null;
  readonly meta: ProxyResponseMeta | null;
  readonly error: ExtractionBatchError | null;
  readonly startedAt: number | null;
  readonly completedAt: number | null;
}

export interface ExtractionState {
  readonly settings: ExtractionSettings;
  readonly runStatus: ExtractionRunStatus;
  readonly batches: Readonly<Record<string, ExtractionBatchState>>;
  readonly startedAt: number | null;
}

export interface ProjectState {
  readonly status: ProjectStatus;
  readonly pdf: LoadedPdf | null;
  readonly currentPage: number;
  readonly zoom: number;
  readonly error: ProjectError | null;
  readonly mapping: MappingState;
  readonly batching: BatchPreparationState;
  readonly extraction: ExtractionState;
}

export const INITIAL_MAPPING_STATE: MappingState = {
  status: "idle",
  data: null,
  meta: null,
  error: null,
  startedAt: null,
  selectedSegmentId: null,
  selectedRegionId: null,
  progress: null
};

export const INITIAL_BATCH_PREPARATION_STATE: BatchPreparationState = {
  settings: DEFAULT_BATCH_SETTINGS,
  plan: null,
  artifacts: {},
  activeBatchId: null,
  errors: {}
};

export const DEFAULT_EXTRACTION_SETTINGS: ExtractionSettings = {
  maxConcurrentBatches: 2,
  maxRetries: 1
};

export const INITIAL_EXTRACTION_STATE: ExtractionState = {
  settings: DEFAULT_EXTRACTION_SETTINGS,
  runStatus: "idle",
  batches: {},
  startedAt: null
};

export const INITIAL_PROJECT_STATE: ProjectState = {
  status: "empty",
  pdf: null,
  currentPage: 1,
  zoom: 1,
  error: null,
  mapping: INITIAL_MAPPING_STATE,
  batching: INITIAL_BATCH_PREPARATION_STATE,
  extraction: INITIAL_EXTRACTION_STATE
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
  | { readonly type: "DELETE_SEGMENT"; readonly segmentId: string }
  | {
      readonly type: "SELECT_REGION";
      readonly segmentId: string;
      readonly regionId: string;
    }
  | {
      readonly type: "UPDATE_REGION_BBOX";
      readonly segmentId: string;
      readonly regionId: string;
      readonly bbox: NormalizedBoundingBox;
    }
  | {
      readonly type: "UPDATE_REGION_ROLE";
      readonly segmentId: string;
      readonly regionId: string;
      readonly role: PageRegionRole;
    }
  | {
      readonly type: "ADD_REGION";
      readonly segmentId: string;
      readonly region: PageRegion;
    }
  | {
      readonly type: "DELETE_REGION";
      readonly segmentId: string;
      readonly regionId: string;
    }
  | { readonly type: "BATCH_SETTINGS_UPDATED"; readonly settings: BatchSettings }
  | { readonly type: "BATCHES_PLANNED"; readonly plan: BatchPlan }
  | { readonly type: "BATCH_GENERATION_STARTED"; readonly batchId: string }
  | { readonly type: "BATCH_GENERATED"; readonly artifact: GeneratedBatchArtifact }
  | { readonly type: "BATCH_GENERATION_FAILED"; readonly batchId: string; readonly error: string }
  | { readonly type: "BATCHES_CLEARED" }
  | { readonly type: "EXTRACTION_SETTINGS_UPDATED"; readonly settings: ExtractionSettings }
  | { readonly type: "EXTRACTION_RUN_STARTED"; readonly startedAt: number }
  | { readonly type: "EXTRACTION_BATCH_PREPARING"; readonly batchId: string; readonly attempt: number }
  | { readonly type: "EXTRACTION_BATCH_PROGRESS"; readonly batchId: string; readonly progress: ExtractionProgress }
  | {
      readonly type: "EXTRACTION_BATCH_SUCCEEDED";
      readonly batchId: string;
      readonly result: ExtractionBatchResult;
      readonly meta: ProxyResponseMeta;
      readonly completedAt: number;
    }
  | {
      readonly type: "EXTRACTION_BATCH_FAILED";
      readonly batchId: string;
      readonly attempt: number;
      readonly error: ExtractionBatchError;
    }
  | { readonly type: "EXTRACTION_BATCH_CANCELLED"; readonly batchId: string }
  | { readonly type: "EXTRACTION_RUN_FINISHED" }
  | { readonly type: "EXTRACTION_RUN_CANCELLED" }
  | { readonly type: "EXTRACTION_CLEARED" }
  | { readonly type: "RESET" };

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.1;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function addPage(pages: readonly number[], page: number): readonly number[] {
  return [...new Set([...pages, page])].sort((left, right) => left - right);
}

function refreshSegmentMetadata(segment: QuestionSegment): QuestionSegment {
  const regionPages = segment.page_regions.map((region) => region.page);
  const questionPages = [...new Set([
    ...regionPages,
    ...segment.answer_pages,
    ...segment.feedback_pages
  ])].sort((left, right) => left - right);

  return {
    ...segment,
    question_pages: questionPages.length > 0 ? questionPages : segment.question_pages,
    contains_essential_image: segment.page_regions.some(
      (region) => region.role === "essential_image"
    )
  };
}

function enrichSegmentMetadata(segment: QuestionSegment, region: PageRegion): QuestionSegment {
  const withPage = region.role === "question" || region.role === "essential_image"
    ? { ...segment, question_pages: addPage(segment.question_pages, region.page) }
    : segment;
  return refreshSegmentMetadata(withPage);
}

function updateSegment(
  documentMap: DocumentMap,
  segmentId: string,
  updater: (segment: QuestionSegment) => QuestionSegment
): DocumentMap {
  return {
    ...documentMap,
    question_segments: documentMap.question_segments.map((segment) =>
      segment.temporary_id === segmentId ? updater(segment) : segment
    )
  };
}

function selectedRegionForPage(
  mapping: MappingState,
  page: number
): string | null {
  if (mapping.data === null || mapping.selectedRegionId === null) {
    return null;
  }

  const selectedRegion = mapping.data.question_segments
    .flatMap((segment) => segment.page_regions)
    .find((region) => region.client_id === mapping.selectedRegionId);
  return selectedRegion?.page === page ? mapping.selectedRegionId : null;
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
        mapping: INITIAL_MAPPING_STATE,
        batching: INITIAL_BATCH_PREPARATION_STATE,
        extraction: INITIAL_EXTRACTION_STATE
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
        },
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
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
        },
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
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
        },
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };

    case "MAPPING_CANCELLED":
      return {
        ...state,
        mapping: INITIAL_MAPPING_STATE,
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };

    case "SELECT_SEGMENT": {
      const segment = state.mapping.data?.question_segments.find(
        (candidate) => candidate.temporary_id === action.segmentId
      );
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

    case "DELETE_SEGMENT": {
      if (state.mapping.data === null) {
        return state;
      }

      const currentIndex = state.mapping.data.question_segments.findIndex(
        (segment) => segment.temporary_id === action.segmentId
      );
      if (currentIndex < 0) {
        return state;
      }

      const questionSegments = state.mapping.data.question_segments.filter(
        (segment) => segment.temporary_id !== action.segmentId
      );
      const nextSegment = questionSegments[Math.min(currentIndex, Math.max(0, questionSegments.length - 1))] ?? null;
      const nextPage = nextSegment?.question_pages[0] ?? nextSegment?.page_regions[0]?.page ?? state.currentPage;
      const nextRegion = nextSegment?.page_regions.find((region) => region.page === nextPage)
        ?? nextSegment?.page_regions[0]
        ?? null;

      return {
        ...state,
        currentPage: nextRegion?.page ?? nextPage,
        mapping: {
          ...state.mapping,
          data: { ...state.mapping.data, question_segments: questionSegments },
          selectedSegmentId: nextSegment?.temporary_id ?? null,
          selectedRegionId: nextRegion?.client_id ?? null
        },
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };
    }

    case "SELECT_REGION": {
      const segment = state.mapping.data?.question_segments.find(
        (candidate) => candidate.temporary_id === action.segmentId
      );
      const region = segment?.page_regions.find(
        (candidate) => candidate.client_id === action.regionId
      );
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
        page_regions: segment.page_regions.map((region) =>
          region.client_id === action.regionId
            ? {
                ...region,
                bbox: clampNormalizedBoundingBox(action.bbox),
                origin: "user"
              }
            : region
        )
      }));

      return {
        ...state,
        mapping: {
          ...state.mapping,
          data,
          selectedSegmentId: action.segmentId,
          selectedRegionId: action.regionId
        },
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };
    }

    case "UPDATE_REGION_ROLE": {
      if (state.mapping.data === null) {
        return state;
      }

      const data = updateSegment(state.mapping.data, action.segmentId, (segment) => {
        const updatedRegions = segment.page_regions.map((region) =>
          region.client_id === action.regionId
            ? { ...region, role: action.role, origin: "user" as const }
            : region
        );
        const updatedRegion = updatedRegions.find((region) => region.client_id === action.regionId);
        const withMetadata = updatedRegion === undefined
          ? segment
          : enrichSegmentMetadata({ ...segment, page_regions: updatedRegions }, updatedRegion);
        return refreshSegmentMetadata(withMetadata);
      });

      return {
        ...state,
        mapping: {
          ...state.mapping,
          data,
          selectedSegmentId: action.segmentId,
          selectedRegionId: action.regionId
        },
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };
    }

    case "ADD_REGION": {
      if (state.mapping.data === null) {
        return state;
      }

      const normalizedRegion: PageRegion = {
        ...action.region,
        bbox: clampNormalizedBoundingBox(action.region.bbox),
        origin: "user"
      };
      const data = updateSegment(state.mapping.data, action.segmentId, (segment) =>
        enrichSegmentMetadata(
          {
            ...segment,
            page_regions: [...segment.page_regions, normalizedRegion]
          },
          normalizedRegion
        )
      );

      return {
        ...state,
        currentPage: normalizedRegion.page,
        mapping: {
          ...state.mapping,
          data,
          selectedSegmentId: action.segmentId,
          selectedRegionId: normalizedRegion.client_id
        },
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };
    }

    case "DELETE_REGION": {
      if (state.mapping.data === null) {
        return state;
      }

      const data = updateSegment(state.mapping.data, action.segmentId, (segment) => {
        const pageRegions = segment.page_regions.filter(
          (region) => region.client_id !== action.regionId
        );
        return refreshSegmentMetadata({ ...segment, page_regions: pageRegions });
      });

      return {
        ...state,
        mapping: {
          ...state.mapping,
          data,
          selectedSegmentId: action.segmentId,
          selectedRegionId:
            state.mapping.selectedRegionId === action.regionId
              ? null
              : state.mapping.selectedRegionId
        },
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };
    }

    case "BATCH_SETTINGS_UPDATED":
      return {
        ...state,
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: normalizeBatchSettings(action.settings)
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };

    case "BATCHES_PLANNED":
      return {
        ...state,
        batching: {
          settings: action.plan.settings,
          plan: action.plan,
          artifacts: {},
          activeBatchId: null,
          errors: {}
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };

    case "BATCH_GENERATION_STARTED": {
      const errors = { ...state.batching.errors };
      delete errors[action.batchId];
      return {
        ...state,
        batching: {
          ...state.batching,
          activeBatchId: action.batchId,
          errors
        }
      };
    }

    case "BATCH_GENERATED":
      return {
        ...state,
        batching: {
          ...state.batching,
          artifacts: {
            ...state.batching.artifacts,
            [action.artifact.batchId]: action.artifact
          },
          activeBatchId:
            state.batching.activeBatchId === action.artifact.batchId
              ? null
              : state.batching.activeBatchId
        },
        extraction: {
          ...state.extraction,
          batches: Object.fromEntries(
            Object.entries(state.extraction.batches).filter(([batchId]) => batchId !== action.artifact.batchId)
          )
        }
      };

    case "BATCH_GENERATION_FAILED":
      return {
        ...state,
        batching: {
          ...state.batching,
          activeBatchId:
            state.batching.activeBatchId === action.batchId
              ? null
              : state.batching.activeBatchId,
          errors: {
            ...state.batching.errors,
            [action.batchId]: action.error
          }
        }
      };

    case "BATCHES_CLEARED":
      return {
        ...state,
        batching: {
          ...INITIAL_BATCH_PREPARATION_STATE,
          settings: state.batching.settings
        },
        extraction: {
          ...INITIAL_EXTRACTION_STATE,
          settings: state.extraction.settings
        }
      };

    case "EXTRACTION_SETTINGS_UPDATED":
      return {
        ...state,
        extraction: {
          ...state.extraction,
          settings: {
            maxConcurrentBatches: clamp(Math.round(action.settings.maxConcurrentBatches), 1, 3),
            maxRetries: clamp(Math.round(action.settings.maxRetries), 0, 2)
          }
        }
      };

    case "EXTRACTION_RUN_STARTED":
      return {
        ...state,
        extraction: { ...state.extraction, runStatus: "running", startedAt: action.startedAt }
      };

    case "EXTRACTION_BATCH_PREPARING": {
      const previous = state.extraction.batches[action.batchId];
      return {
        ...state,
        extraction: {
          ...state.extraction,
          batches: {
            ...state.extraction.batches,
            [action.batchId]: {
              status: "preparing",
              attempts: action.attempt,
              progress: null,
              result: previous?.result ?? null,
              meta: previous?.meta ?? null,
              error: null,
              startedAt: previous?.startedAt ?? Date.now(),
              completedAt: null
            }
          }
        }
      };
    }

    case "EXTRACTION_BATCH_PROGRESS": {
      const previous = state.extraction.batches[action.batchId];
      if (previous === undefined) return state;
      return {
        ...state,
        extraction: {
          ...state.extraction,
          batches: {
            ...state.extraction.batches,
            [action.batchId]: {
              ...previous,
              status: action.progress.providerStatus,
              progress: action.progress
            }
          }
        }
      };
    }

    case "EXTRACTION_BATCH_SUCCEEDED": {
      const previous = state.extraction.batches[action.batchId];
      return {
        ...state,
        extraction: {
          ...state.extraction,
          batches: {
            ...state.extraction.batches,
            [action.batchId]: {
              status: "completed",
              attempts: previous?.attempts ?? 1,
              progress: null,
              result: action.result,
              meta: action.meta,
              error: null,
              startedAt: previous?.startedAt ?? null,
              completedAt: action.completedAt
            }
          }
        }
      };
    }

    case "EXTRACTION_BATCH_FAILED": {
      const previous = state.extraction.batches[action.batchId];
      return {
        ...state,
        extraction: {
          ...state.extraction,
          batches: {
            ...state.extraction.batches,
            [action.batchId]: {
              status: "failed",
              attempts: action.attempt,
              progress: null,
              result: previous?.result ?? null,
              meta: previous?.meta ?? null,
              error: action.error,
              startedAt: previous?.startedAt ?? null,
              completedAt: null
            }
          }
        }
      };
    }

    case "EXTRACTION_BATCH_CANCELLED": {
      const previous = state.extraction.batches[action.batchId];
      if (previous === undefined) return state;
      return {
        ...state,
        extraction: {
          ...state.extraction,
          batches: {
            ...state.extraction.batches,
            [action.batchId]: { ...previous, status: "cancelled", progress: null }
          }
        }
      };
    }

    case "EXTRACTION_RUN_FINISHED":
      return {
        ...state,
        extraction: { ...state.extraction, runStatus: "completed", startedAt: null }
      };

    case "EXTRACTION_RUN_CANCELLED":
      return {
        ...state,
        extraction: { ...state.extraction, runStatus: "cancelled", startedAt: null }
      };

    case "EXTRACTION_CLEARED":
      return {
        ...state,
        extraction: { ...INITIAL_EXTRACTION_STATE, settings: state.extraction.settings }
      };

    case "RESET":
      return INITIAL_PROJECT_STATE;
  }
}
