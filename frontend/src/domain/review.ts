import { createZipBlob, type ZipEntryInput } from "../export/createZip";
import type { DocumentMap } from "./documentMap";
import type {
  ContentOrigin,
  CorrectAnswerOrigin,
  ExtractedChoice,
  ExtractedQuestion,
  QuestionType
} from "./extraction";
import type {
  GeneratedIllustrationAsset,
  IllustrationCandidate,
  IllustrationPlan
} from "./illustration";
import type { LoadedPdf } from "./projectState";

export interface EditableChoice {
  readonly id: string;
  readonly content: string;
}

export interface ReviewQuestion {
  readonly id: string;
  readonly segmentId: string;
  readonly type: QuestionType;
  readonly title: string;
  readonly titleOrigin: ContentOrigin;
  readonly statement: string;
  readonly choices: readonly EditableChoice[];
  readonly correctChoiceIds: readonly string[];
  readonly correctAnswerOrigin: CorrectAnswerOrigin;
  readonly feedback: string;
  readonly feedbackOrigin: ContentOrigin;
  readonly sourcePages: readonly number[];
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly validated: boolean;
}

export interface ReviewExportDocument {
  readonly schema_version: "1.0.0";
  readonly content_format: "markdown-latex";
  readonly document: {
    readonly title: string;
    readonly language: string;
    readonly source_filename: string;
    readonly source_sha256: string | null;
  };
  readonly questions: readonly {
    readonly id: string;
    readonly type: QuestionType;
    readonly title: string;
    readonly title_origin: ContentOrigin;
    readonly statement: string;
    readonly choices: readonly EditableChoice[];
    readonly correct_choice_ids: readonly string[];
    readonly correct_answer_origin: CorrectAnswerOrigin;
    readonly feedback: string;
    readonly feedback_origin: ContentOrigin;
    readonly assets: readonly {
      readonly id: string;
      readonly role: "essential";
      readonly path: string;
      readonly mime_type: "image/png";
      readonly alt_text: string;
      readonly source: {
        readonly page: number;
        readonly bbox: IllustrationCandidate["bbox"];
      };
    }[];
    readonly source_pages: readonly number[];
    readonly validation_status: "validated";
  }[];
}

function exportChoiceId(id: string): string {
  const clean = id.replace(/^choice-/, "").replace(/[^A-Za-z0-9._-]+/g, "-") || "option";
  return `choice-${clean}`;
}

function normalizeChoiceIds(question: ExtractedQuestion): {
  readonly choices: readonly EditableChoice[];
  readonly correctChoiceIds: readonly string[];
} {
  const idMap = new Map<string, string>();
  const used = new Set<string>();
  const choices = question.choices.map((choice: ExtractedChoice, index) => {
    const base = exportChoiceId(choice.id || String.fromCharCode(97 + index));
    let id = base;
    let serial = 2;
    while (used.has(id)) {
      id = `${base}-${serial}`;
      serial += 1;
    }
    used.add(id);
    idMap.set(choice.id, id);
    return { id, content: choice.content };
  });

  return {
    choices,
    correctChoiceIds: question.correct_choice_ids
      .map((id) => idMap.get(id))
      .filter((id): id is string => id !== undefined)
  };
}

export function createReviewQuestions(questions: readonly ExtractedQuestion[]): readonly ReviewQuestion[] {
  return questions.map((question) => {
    const normalizedChoices = normalizeChoiceIds(question);
    return {
      id: question.id,
      segmentId: question.segment_id,
      type: question.type === "true_false" ? "single_choice" : question.type,
      title: question.title.content,
      titleOrigin: question.title.origin,
      statement: question.statement,
      choices: normalizedChoices.choices,
      correctChoiceIds: normalizedChoices.correctChoiceIds,
      correctAnswerOrigin: question.correct_answer_origin,
      feedback: question.feedback.content,
      feedbackOrigin: question.feedback.origin,
      sourcePages: question.source_pages,
      confidence: question.confidence,
      warnings: question.warnings,
      validated: false
    };
  });
}

export function reviewSourceFingerprint(questions: readonly ExtractedQuestion[]): string {
  return questions.map((question) => [
    question.id,
    question.segment_id,
    question.type,
    question.title.content,
    question.statement,
    question.choices.map((choice) => `${choice.id}:${choice.content}`).join("|"),
    question.correct_choice_ids.join(","),
    question.feedback.content,
    question.source_pages.join(",")
  ].join("::")).join("\n");
}


export function reviewQuestionIssues(question: ReviewQuestion): readonly string[] {
  const issues: string[] = [];
  if (question.title.trim().length === 0) issues.push("Le titre est vide.");
  if (question.statement.trim().length === 0) issues.push("L’énoncé est vide.");
  if (question.choices.length < 2) issues.push("Au moins deux propositions sont nécessaires.");
  if (question.type === "true_false" && question.choices.length !== 2) {
    issues.push("Une question vrai ou faux doit contenir exactement deux propositions.");
  }
  if (question.choices.some((choice) => choice.content.trim().length === 0)) {
    issues.push("Toutes les propositions doivent contenir un texte.");
  }
  const choiceIds = new Set(question.choices.map((choice) => choice.id));
  if (choiceIds.size !== question.choices.length) issues.push("Les identifiants de propositions ne sont pas uniques.");
  if (question.correctChoiceIds.some((id) => !choiceIds.has(id))) {
    issues.push("Une réponse correcte référence une proposition inexistante.");
  }
  if (isSingleReviewQuestion(question) && question.correctChoiceIds.length > 1) {
    issues.push("Ce type de question ne peut avoir qu’une seule réponse correcte.");
  }
  if (question.correctAnswerOrigin === "not_available" && question.correctChoiceIds.length > 0) {
    issues.push("Une réponse correcte est sélectionnée alors que son origine est indiquée comme indisponible.");
  }
  if (question.correctAnswerOrigin !== "not_available" && question.correctChoiceIds.length === 0) {
    issues.push("Sélectionnez une réponse correcte ou indiquez qu’elle n’est pas disponible.");
  }
  if (question.feedback.trim().length === 0) {
    issues.push("Le feedback pédagogique est vide.");
  }
  if (question.sourcePages.length === 0) issues.push("Aucune page source n’est associée à la question.");
  return issues;
}

function isSingleReviewQuestion(question: ReviewQuestion): boolean {
  return question.type === "single_choice" || question.type === "true_false";
}

export function nextChoiceId(choices: readonly EditableChoice[]): string {
  const used = new Set(choices.map((choice) => choice.id));
  for (let index = 0; index < 26; index += 1) {
    const candidate = `choice-${String.fromCharCode(97 + index)}`;
    if (!used.has(candidate)) return candidate;
  }

  let serial = choices.length + 1;
  while (used.has(`choice-${serial}`)) serial += 1;
  return `choice-${serial}`;
}

function candidatesForQuestion(
  plan: IllustrationPlan,
  question: ReviewQuestion
): readonly IllustrationCandidate[] {
  return plan.candidates.filter((candidate) =>
    candidate.questionId === question.id ||
    (candidate.questionId === null && candidate.segmentId === question.segmentId)
  );
}

function replaceAssetTokens(
  statement: string,
  candidates: readonly IllustrationCandidate[]
): string {
  let result = statement;
  const append: string[] = [];

  candidates.forEach((candidate) => {
    const markdown = `![${candidate.altText}](assets/${candidate.fileName})`;
    if (result.includes(candidate.insertionToken)) {
      result = result.split(candidate.insertionToken).join(markdown);
    } else if (candidate.role === "essential") {
      append.push(markdown);
    }
  });

  if (append.length > 0) {
    result = `${result.trim()}\n\n${append.join("\n\n")}`;
  }
  return result;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string | null> {
  if (globalThis.crypto?.subtle === undefined) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes.slice(0));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function createReviewExport(
  pdf: LoadedPdf,
  documentMap: DocumentMap,
  questions: readonly ReviewQuestion[],
  illustrationPlan: IllustrationPlan,
  generatedAssets: Readonly<Record<string, GeneratedIllustrationAsset>>
): Promise<ReviewExportDocument> {
  const sourceSha256 = await sha256Hex(pdf.bytes);

  return {
    schema_version: "1.0.0",
    content_format: "markdown-latex",
    document: {
      title: documentMap.document.title || pdf.title || pdf.fileName.replace(/\.pdf$/i, ""),
      language: documentMap.document.language || "fr",
      source_filename: pdf.fileName,
      source_sha256: sourceSha256
    },
    questions: questions.map((question) => {
      const candidates = candidatesForQuestion(illustrationPlan, question);
      return {
        id: question.id,
        type: question.type,
        title: question.title,
        title_origin: question.titleOrigin,
        statement: replaceAssetTokens(question.statement, candidates),
        choices: question.choices,
        correct_choice_ids: question.correctChoiceIds,
        correct_answer_origin: question.correctAnswerOrigin,
        feedback: question.feedback,
        feedback_origin: question.feedbackOrigin,
        assets: candidates.map((candidate) => ({
          id: candidate.id.startsWith("asset-") ? candidate.id : `asset-${candidate.id}`,
          role: candidate.role,
          path: `assets/${candidate.fileName}`,
          mime_type: generatedAssets[candidate.id]?.mimeType ?? "image/png",
          alt_text: candidate.altText,
          source: {
            page: candidate.sourcePage,
            bbox: candidate.bbox
          }
        })),
        source_pages: question.sourcePages,
        validation_status: "validated"
      };
    })
  };
}

export async function createReviewArchive(
  value: ReviewExportDocument,
  illustrationPlan: IllustrationPlan,
  generatedAssets: Readonly<Record<string, GeneratedIllustrationAsset>>
): Promise<Blob> {
  const entries: ZipEntryInput[] = [{
    name: "questions.json",
    data: JSON.stringify(value, null, 2)
  }];
  const usedPaths = new Set<string>();

  for (const candidate of illustrationPlan.candidates) {
    const asset = generatedAssets[candidate.id];
    if (asset === undefined) {
      throw new Error(`L’illustration ${candidate.fileName} n’a pas été générée.`);
    }

    const path = `assets/${candidate.fileName}`;
    if (usedPaths.has(path)) {
      throw new Error(`Le chemin d’illustration ${path} apparaît plusieurs fois.`);
    }
    usedPaths.add(path);
    entries.push({ name: path, data: asset.blob });
  }

  return createZipBlob(entries);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportFileName(sourceFileName: string): string {
  const base = sourceFileName.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-") || "qcm";
  return `${base}-qcm.zip`;
}
