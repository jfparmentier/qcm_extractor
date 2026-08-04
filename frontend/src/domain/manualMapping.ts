import type { DocumentMap, QuestionSegment } from "./documentMap";

function createUserSegmentId(): string {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `segment-manual-${randomPart}`;
}

export function createManualDocumentMap(
  title: string,
  pageCount: number
): DocumentMap {
  return {
    schema_version: "1.0.0",
    document: {
      title,
      language: "fr",
      document_type: "unknown",
      page_count: pageCount,
      warnings: []
    },
    question_segments: []
  };
}

export function createUserQuestionSegment(
  page: number
): QuestionSegment {
  return {
    temporary_id: createUserSegmentId(),
    // Le rang dans l'interface n'est pas nécessairement le numéro imprimé dans le PDF.
    // Garder cette valeur inconnue évite d'orienter l'extraction vers une autre question.
    question_number: null,
    question_pages: [page],
    answer_pages: [],
    feedback_pages: [],
    contains_essential_image: false,
    question_type_hint: "unknown",
    page_regions: [],
    confidence: 1,
    warnings: []
  };
}
