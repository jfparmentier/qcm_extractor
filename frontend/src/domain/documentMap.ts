import Ajv2020 from "ajv/dist/2020";
import type { AnySchema, ErrorObject } from "ajv";
import mappingSchema from "../schemas/mappingSchema";

export type DocumentType =
  | "slides"
  | "dense_question_bank"
  | "scanned_document"
  | "mixed"
  | "unknown";

export type QuestionTypeHint =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "unknown";

export type PageRegionRole =
  | "question"
  | "choices"
  | "answer"
  | "feedback"
  | "essential_image"
  | "decorative_image"
  | "context";

export interface NormalizedBoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PageRegion {
  readonly page: number;
  readonly role: PageRegionRole;
  readonly bbox: NormalizedBoundingBox;
}

export interface QuestionSegment {
  readonly temporary_id: string;
  readonly question_number: string | null;
  readonly question_pages: readonly number[];
  readonly answer_pages: readonly number[];
  readonly feedback_pages: readonly number[];
  readonly contains_essential_image: boolean;
  readonly question_type_hint: QuestionTypeHint;
  readonly page_regions: readonly PageRegion[];
  readonly confidence: number;
  readonly warnings: readonly string[];
}

export interface DocumentMap {
  readonly schema_version: "1.0.0";
  readonly document: {
    readonly title: string;
    readonly language: string;
    readonly document_type: DocumentType;
    readonly page_count: number;
    readonly warnings: readonly string[];
  };
  readonly question_segments: readonly QuestionSegment[];
}

export interface MappingValidationResult {
  readonly documentMap: DocumentMap;
  readonly diagnostics: readonly string[];
}

export class DocumentMapValidationError extends Error {
  public constructor(
    message: string,
    public readonly issues: readonly string[]
  ) {
    super(message);
    this.name = "DocumentMapValidationError";
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false
});
const validateSchema = ajv.compile<DocumentMap>(mappingSchema as AnySchema);

function formatAjvErrors(errors: readonly ErrorObject[] | null | undefined): string[] {
  if (errors === null || errors === undefined) {
    return [];
  }

  return errors.map((error) => {
    const location = error.instancePath.length > 0 ? error.instancePath : "/";
    return `${location} : ${error.message ?? "valeur invalide"}`;
  });
}

function uniqueSortedPages(pages: readonly number[]): number[] {
  return [...new Set(pages)].sort((left, right) => left - right);
}

function assertPagesExist(
  pages: readonly number[],
  pageCount: number,
  label: string,
  segmentId: string
): void {
  const invalid = pages.filter((page) => page < 1 || page > pageCount);
  if (invalid.length > 0) {
    throw new DocumentMapValidationError(
      "La cartographie référence des pages inexistantes.",
      [`${segmentId}.${label} : ${invalid.join(", ")}`]
    );
  }
}

function normalizeBbox(
  bbox: NormalizedBoundingBox,
  segmentId: string,
  diagnostics: string[]
): NormalizedBoundingBox {
  const right = bbox.x + bbox.width;
  const bottom = bbox.y + bbox.height;
  if (right <= 1 && bottom <= 1) {
    return bbox;
  }

  const width = Math.min(bbox.width, Math.max(0, 1 - bbox.x));
  const height = Math.min(bbox.height, Math.max(0, 1 - bbox.y));
  if (width <= 0 || height <= 0) {
    throw new DocumentMapValidationError(
      "Une région de la cartographie se situe hors de la page.",
      [`${segmentId} : bbox impossible à normaliser`]
    );
  }

  diagnostics.push(
    `${segmentId} : une région dépassait la page et a été ramenée à ses limites.`
  );
  return { x: bbox.x, y: bbox.y, width, height };
}

function overlapRatio(first: NormalizedBoundingBox, second: NormalizedBoundingBox): number {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  if (intersection === 0) {
    return 0;
  }

  const firstArea = first.width * first.height;
  const secondArea = second.width * second.height;
  return intersection / Math.min(firstArea, secondArea);
}

function detectStrongOverlaps(segments: readonly QuestionSegment[]): string[] {
  const warnings: string[] = [];
  for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
    const first = segments[firstIndex];
    if (first === undefined) {
      continue;
    }

    for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
      const second = segments[secondIndex];
      if (second === undefined) {
        continue;
      }

      const firstRegions = first.page_regions.filter(
        (region) => region.role === "question" || region.role === "choices"
      );
      const secondRegions = second.page_regions.filter(
        (region) => region.role === "question" || region.role === "choices"
      );

      const stronglyOverlapping = firstRegions.some((firstRegion) =>
        secondRegions.some(
          (secondRegion) =>
            firstRegion.page === secondRegion.page &&
            overlapRatio(firstRegion.bbox, secondRegion.bbox) >= 0.8
        )
      );

      if (stronglyOverlapping) {
        warnings.push(
          `${first.temporary_id} et ${second.temporary_id} se superposent fortement ; vérifiez qu’il ne s’agit pas d’un doublon.`
        );
      }
    }
  }

  return warnings;
}

export function validateAndNormalizeDocumentMap(
  value: unknown,
  actualPageCount: number
): MappingValidationResult {
  if (!validateSchema(value)) {
    throw new DocumentMapValidationError(
      "La réponse du LLM ne respecte pas le schéma de cartographie.",
      formatAjvErrors(validateSchema.errors)
    );
  }

  const diagnostics: string[] = [];
  const ids = new Set<string>();
  const segments = value.question_segments.map((segment) => {
    if (ids.has(segment.temporary_id)) {
      throw new DocumentMapValidationError(
        "La cartographie contient des identifiants dupliqués.",
        [segment.temporary_id]
      );
    }
    ids.add(segment.temporary_id);

    const questionPages = uniqueSortedPages(segment.question_pages);
    const answerPages = uniqueSortedPages(segment.answer_pages);
    const feedbackPages = uniqueSortedPages(segment.feedback_pages);
    assertPagesExist(questionPages, actualPageCount, "question_pages", segment.temporary_id);
    assertPagesExist(answerPages, actualPageCount, "answer_pages", segment.temporary_id);
    assertPagesExist(feedbackPages, actualPageCount, "feedback_pages", segment.temporary_id);

    const pageRegions = segment.page_regions.map((region) => {
      assertPagesExist([region.page], actualPageCount, "page_regions", segment.temporary_id);
      return {
        ...region,
        bbox: normalizeBbox(region.bbox, segment.temporary_id, diagnostics)
      };
    });

    if (!pageRegions.some((region) => region.role === "question" || region.role === "choices")) {
      diagnostics.push(
        `${segment.temporary_id} : aucune région d’énoncé ou de propositions n’a été localisée.`
      );
    }

    return {
      ...segment,
      question_pages: questionPages,
      answer_pages: answerPages,
      feedback_pages: feedbackPages,
      page_regions: pageRegions,
      warnings: [...new Set(segment.warnings)]
    } satisfies QuestionSegment;
  });

  segments.sort((left, right) => {
    const pageDifference = (left.question_pages[0] ?? 1) - (right.question_pages[0] ?? 1);
    return pageDifference !== 0
      ? pageDifference
      : left.temporary_id.localeCompare(right.temporary_id, "fr");
  });

  if (value.document.page_count !== actualPageCount) {
    diagnostics.push(
      `Le LLM a indiqué ${value.document.page_count} pages, tandis que le lecteur PDF en compte ${actualPageCount}. La valeur locale a été retenue.`
    );
  }

  diagnostics.push(...detectStrongOverlaps(segments));

  return {
    documentMap: {
      ...value,
      document: {
        ...value.document,
        page_count: actualPageCount,
        warnings: [...new Set([...value.document.warnings, ...diagnostics])]
      },
      question_segments: segments
    },
    diagnostics
  };
}

export function getSegmentDisplayName(segment: QuestionSegment, index: number): string {
  if (segment.question_number !== null && segment.question_number.trim().length > 0) {
    return `Question ${segment.question_number.trim()}`;
  }

  return `Question détectée ${index + 1}`;
}

export function getQuestionTypeLabel(type: QuestionTypeHint): string {
  switch (type) {
    case "single_choice":
      return "Réponse unique";
    case "multiple_choice":
      return "Réponses multiples";
    case "true_false":
      return "Vrai / faux";
    case "unknown":
      return "Type à vérifier";
  }
}

export function getDocumentTypeLabel(type: DocumentType): string {
  switch (type) {
    case "slides":
      return "Diaporama";
    case "dense_question_bank":
      return "Banque dense";
    case "scanned_document":
      return "Document numérisé";
    case "mixed":
      return "Document mixte";
    case "unknown":
      return "Type indéterminé";
  }
}
