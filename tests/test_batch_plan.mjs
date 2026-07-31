import {
  createBatchPlan,
  formatPageRanges,
  normalizeBatchSettings
} from "../deployment/qcm-extractor-site/public/assets/domain/batchPlan.js";

function region(page, id) {
  return {
    client_id: id,
    page,
    role: "question",
    bbox: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
    origin: "llm"
  };
}

function segment(id, pages) {
  return {
    temporary_id: id,
    question_number: null,
    question_pages: pages,
    answer_pages: [],
    feedback_pages: [],
    contains_essential_image: false,
    question_type_hint: "single_choice",
    page_regions: pages.map((page, index) => region(page, `${id}-r${index + 1}`)),
    confidence: 1,
    warnings: []
  };
}

const documentMap = {
  schema_version: "1.0.0",
  document: {
    title: "Test",
    language: "fr",
    document_type: "slides",
    page_count: 20,
    warnings: []
  },
  question_segments: [
    segment("segment-001", [2]),
    segment("segment-002", [3]),
    segment("segment-003", [10]),
    segment("segment-004", [11]),
    segment("segment-005", [12])
  ]
};

const plan = createBatchPlan(documentMap, 2_000_000, 20, {
  maxQuestionsPerBatch: 2,
  maxPagesPerBatch: 6,
  maxEstimatedBytes: 12 * 1024 * 1024,
  contextPaddingPages: 1,
  maxGapPages: 2
});

if (plan.batches.length !== 3) {
  throw new Error(`Trois lots attendus, ${plan.batches.length} obtenus.`);
}
if (plan.batches[0].originalPages.join(",") !== "1,2,3,4") {
  throw new Error("Le contexte autour du premier lot est incorrect.");
}
if (plan.batches[0].pageMap[1].originalPage !== 2) {
  throw new Error("La correspondance page locale/originale est incorrecte.");
}
if (plan.duplicatedContextPages !== 2) {
  throw new Error("Le décompte des pages de contexte dupliquées est incorrect.");
}
if (formatPageRanges([1, 2, 3, 5, 7, 8]) !== "1–3, 5, 7–8") {
  throw new Error("Le formatage des plages de pages est incorrect.");
}

const normalized = normalizeBatchSettings({
  maxQuestionsPerBatch: 0,
  maxPagesPerBatch: 100,
  maxEstimatedBytes: 1,
  contextPaddingPages: 9,
  maxGapPages: -2
});
if (
  normalized.maxQuestionsPerBatch !== 1 ||
  normalized.maxPagesPerBatch !== 40 ||
  normalized.maxEstimatedBytes !== 1024 * 1024 ||
  normalized.contextPaddingPages !== 3 ||
  normalized.maxGapPages !== 0
) {
  throw new Error("La normalisation des paramètres est incorrecte.");
}

console.log("OK lots : regroupement, contexte et correspondance des pages");
