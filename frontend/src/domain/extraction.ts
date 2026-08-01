import Ajv2020 from "ajv/dist/2020";
import type { AnySchema, ErrorObject } from "ajv";
import extractionSchema from "../schemas/extractionSchema";
import type { ProxyResponseMeta } from "../api/proxyClient";
import type { DocumentMap, NormalizedBoundingBox, QuestionSegment } from "./documentMap";
import { clampNormalizedBoundingBox } from "./documentMap";
import type { PlannedBatch } from "./batchPlan";

export type QuestionType = "single_choice" | "multiple_choice" | "true_false";
export type ContentOrigin =
  | "explicit_in_document"
  | "generated_by_model"
  | "provided_by_user"
  | "not_available";
export type CorrectAnswerOrigin =
  | "explicit_in_document"
  | "inferred_by_model"
  | "provided_by_user"
  | "not_available";

export interface ProvenancedText {
  readonly content: string;
  readonly origin: ContentOrigin;
}

export interface ExtractedChoice {
  readonly id: string;
  readonly content: string;
}

export interface ExtractedImage {
  readonly id: string;
  readonly role: "essential" | "decorative";
  readonly source_page: number;
  readonly bbox: NormalizedBoundingBox;
  readonly alt_text: string;
  readonly insertion_token: string;
}

export interface ExtractedQuestion {
  readonly id: string;
  readonly segment_id: string;
  readonly type: QuestionType;
  readonly title: ProvenancedText;
  readonly content_format: "markdown-latex";
  readonly statement: string;
  readonly choices: readonly ExtractedChoice[];
  readonly correct_choice_ids: readonly string[];
  readonly correct_answer_origin: CorrectAnswerOrigin;
  readonly feedback: ProvenancedText;
  readonly images: readonly ExtractedImage[];
  readonly source_pages: readonly number[];
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly status: "draft";
}

export interface ExtractionBatchResult {
  readonly schema_version: "1.0.0";
  readonly batch_id: string;
  readonly source_document: {
    readonly title: string;
    readonly language: string;
  };
  readonly questions: readonly ExtractedQuestion[];
  readonly missing_segment_ids: readonly string[];
  readonly warnings: readonly string[];
}

export interface ValidatedExtractionBatch {
  readonly result: ExtractionBatchResult;
  readonly diagnostics: readonly string[];
}

export interface CompletedBatchExtraction {
  readonly batchId: string;
  readonly result: ExtractionBatchResult;
  readonly meta: ProxyResponseMeta;
}

export interface MergedExtractionResult {
  readonly questions: readonly ExtractedQuestion[];
  readonly missingSegmentIds: readonly string[];
  readonly duplicateSegmentIds: readonly string[];
  readonly unexpectedSegmentIds: readonly string[];
  readonly completedBatchIds: readonly string[];
  readonly warnings: readonly string[];
}

export class ExtractionValidationError extends Error {
  public constructor(
    message: string,
    public readonly issues: readonly string[]
  ) {
    super(message);
    this.name = "ExtractionValidationError";
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false
});
const validateSchema = ajv.compile<ExtractionBatchResult>(extractionSchema as AnySchema);

function formatAjvErrors(errors: readonly ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const location = error.instancePath.length > 0 ? error.instancePath : "/";
    return `${location} : ${error.message ?? "valeur invalide"}`;
  });
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function normalizePage(
  page: number,
  batch: PlannedBatch,
  diagnostics: string[],
  label: string
): number {
  if (batch.originalPages.includes(page)) {
    return page;
  }

  const mapped = batch.pageMap.find((entry) => entry.localPage === page)?.originalPage;
  if (mapped !== undefined) {
    diagnostics.push(`${label} : la page locale ${page} a été convertie en page originale ${mapped}.`);
    return mapped;
  }

  throw new ExtractionValidationError(
    "Le résultat d’extraction référence une page étrangère au lot.",
    [`${label} : page ${page}`]
  );
}

function normalizeQuestion(
  question: ExtractedQuestion,
  batch: PlannedBatch,
  diagnostics: string[]
): ExtractedQuestion {
  const choiceIds = new Set<string>();
  for (const choice of question.choices) {
    if (choiceIds.has(choice.id)) {
      throw new ExtractionValidationError(
        "Une question contient des identifiants de propositions dupliqués.",
        [`${question.segment_id} : ${choice.id}`]
      );
    }
    choiceIds.add(choice.id);
  }

  let correctChoiceIds = unique(question.correct_choice_ids).filter((id) => choiceIds.has(id));
  const removedCorrectIds = question.correct_choice_ids.filter((id) => !choiceIds.has(id));
  if (removedCorrectIds.length > 0) {
    diagnostics.push(
      `${question.segment_id} : des réponses correctes inexistantes ont été retirées (${removedCorrectIds.join(", ")}).`
    );
  }

  let correctAnswerOrigin = question.correct_answer_origin;
  if (correctAnswerOrigin === "not_available") {
    correctChoiceIds = [];
  } else if (correctChoiceIds.length === 0) {
    correctAnswerOrigin = "not_available";
    diagnostics.push(
      `${question.segment_id} : l’origine de la réponse a été ramenée à not_available faute de proposition valide.`
    );
  }
  if ((question.type === "single_choice" || question.type === "true_false") && correctChoiceIds.length > 1) {
    correctChoiceIds = correctChoiceIds.slice(0, 1);
    diagnostics.push(`${question.segment_id} : une seule réponse correcte a été conservée.`);
  }

  const sourcePages = unique(
    question.source_pages.map((page) => normalizePage(page, batch, diagnostics, question.segment_id))
  ).sort((left, right) => left - right);

  const images = question.images.map((image, index) => ({
    ...image,
    source_page: normalizePage(
      image.source_page,
      batch,
      diagnostics,
      `${question.segment_id}.images[${index}]`
    ),
    bbox: clampNormalizedBoundingBox(image.bbox)
  }));

  const warnings = unique([...question.warnings]);
  if (question.type === "true_false" && question.choices.length !== 2) {
    warnings.push("Une question vrai/faux ne contient pas exactement deux propositions.");
  }

  if (question.feedback.content.trim().length === 0 || question.feedback.origin === "not_available") {
    throw new ExtractionValidationError(
      "Une question ne contient pas le feedback pédagogique obligatoire.",
      [`${question.segment_id} : feedback absent ou non généré`]
    );
  }

  return {
    ...question,
    title:
      question.title.origin === "not_available"
        ? { content: "", origin: "not_available" }
        : question.title,
    feedback: question.feedback,
    correct_choice_ids: correctChoiceIds,
    correct_answer_origin: correctAnswerOrigin,
    source_pages: sourcePages,
    images,
    confidence: Math.min(1, Math.max(0, question.confidence)),
    warnings
  };
}

export function validateAndNormalizeExtractionResult(
  value: unknown,
  batch: PlannedBatch
): ValidatedExtractionBatch {
  if (!validateSchema(value)) {
    throw new ExtractionValidationError(
      "La réponse du LLM ne respecte pas le schéma d’extraction.",
      formatAjvErrors(validateSchema.errors)
    );
  }

  const diagnostics: string[] = [];
  const result = value as ExtractionBatchResult;
  if (result.batch_id !== batch.id) {
    diagnostics.push(`Le LLM a renvoyé le lot ${result.batch_id}; l’identifiant attendu ${batch.id} a été retenu.`);
  }

  const expectedIds = new Set(batch.segmentIds);
  const questionIds = new Set<string>();
  const questions = result.questions.map((question) => {
    if (questionIds.has(question.id)) {
      diagnostics.push(`${question.segment_id} : l’identifiant ${question.id} est dupliqué dans le lot.`);
    }
    questionIds.add(question.id);
    if (!expectedIds.has(question.segment_id)) {
      diagnostics.push(`${question.segment_id} : ce segment n’était pas attendu dans ${batch.id}.`);
    }
    return normalizeQuestion(question, batch, diagnostics);
  });

  const seenSegments = new Set(questions.map((question) => question.segment_id));
  const computedMissing = batch.segmentIds.filter((segmentId) => !seenSegments.has(segmentId));
  const reportedMissing = result.missing_segment_ids.filter((segmentId) => expectedIds.has(segmentId));
  const missingSegmentIds = unique([...computedMissing, ...reportedMissing]);

  return {
    result: {
      ...result,
      batch_id: batch.id,
      questions,
      missing_segment_ids: missingSegmentIds,
      warnings: unique([...result.warnings, ...diagnostics])
    },
    diagnostics
  };
}

function alphabeticChoiceId(index: number): string {
  let value = index;
  let label = "";
  do {
    label = String.fromCharCode(97 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return `choice-${label}`;
}

function rewriteQuestionIdentifiers(question: ExtractedQuestion, globalIndex: number): ExtractedQuestion {
  const serial = (globalIndex + 1).toString().padStart(3, "0");
  const choiceMap = new Map<string, string>();
  const choices = question.choices.map((choice, index) => {
    const newId = alphabeticChoiceId(index);
    choiceMap.set(choice.id, newId);
    return { ...choice, id: newId };
  });

  let statement = question.statement;
  const images = question.images.map((image, index) => {
    const imageSerial = (index + 1).toString().padStart(2, "0");
    const newId = `asset-${serial}-${imageSerial}`;
    const newToken = `asset:${serial}-${imageSerial}`;
    statement = statement.split(image.insertion_token).join(newToken);
    return { ...image, id: newId, insertion_token: newToken };
  });

  return {
    ...question,
    id: `q-${serial}`,
    statement,
    choices,
    correct_choice_ids: question.correct_choice_ids
      .map((id) => choiceMap.get(id))
      .filter((id): id is string => id !== undefined),
    images
  };
}

export function mergeExtractionResults(
  documentMap: DocumentMap,
  completed: readonly CompletedBatchExtraction[]
): MergedExtractionResult {
  const expectedOrder = new Map(
    documentMap.question_segments.map((segment, index) => [segment.temporary_id, index])
  );
  const questionsBySegment = new Map<string, ExtractedQuestion[]>();
  const completedBatchIds: string[] = [];
  const warnings: string[] = [];

  for (const batch of completed) {
    completedBatchIds.push(batch.batchId);
    warnings.push(...batch.result.warnings.map((warning) => `${batch.batchId} : ${warning}`));
    for (const question of batch.result.questions) {
      const existing = questionsBySegment.get(question.segment_id) ?? [];
      existing.push(question);
      questionsBySegment.set(question.segment_id, existing);
    }
  }

  const duplicateSegmentIds = [...questionsBySegment.entries()]
    .filter(([, questions]) => questions.length > 1)
    .map(([segmentId]) => segmentId);
  const unexpectedSegmentIds = [...questionsBySegment.keys()].filter(
    (segmentId) => !expectedOrder.has(segmentId)
  );
  const missingSegmentIds = documentMap.question_segments
    .map((segment) => segment.temporary_id)
    .filter((segmentId) => !questionsBySegment.has(segmentId));

  const orderedQuestions = [...questionsBySegment.entries()]
    .filter(([segmentId]) => expectedOrder.has(segmentId))
    .sort(([left], [right]) => (expectedOrder.get(left) ?? 0) - (expectedOrder.get(right) ?? 0))
    .map(([, questions]) => questions[0])
    .filter((question): question is ExtractedQuestion => question !== undefined)
    .map(rewriteQuestionIdentifiers);

  if (duplicateSegmentIds.length > 0) {
    warnings.push(`Des extractions multiples existent pour : ${duplicateSegmentIds.join(", ")}. La première a été retenue.`);
  }
  if (unexpectedSegmentIds.length > 0) {
    warnings.push(`Des segments inattendus ont été ignorés : ${unexpectedSegmentIds.join(", ")}.`);
  }
  if (missingSegmentIds.length > 0) {
    warnings.push(`${missingSegmentIds.length} segment(s) ne disposent pas encore d’une question extraite.`);
  }

  return {
    questions: orderedQuestions,
    missingSegmentIds,
    duplicateSegmentIds,
    unexpectedSegmentIds,
    completedBatchIds: unique(completedBatchIds),
    warnings: unique(warnings)
  };
}

export function getSegmentById(documentMap: DocumentMap, segmentId: string): QuestionSegment | null {
  return documentMap.question_segments.find((segment) => segment.temporary_id === segmentId) ?? null;
}
