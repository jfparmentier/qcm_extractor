import assert from "node:assert/strict";
import { createIllustrationPlan } from "../deployment/qcm-extractor-site/public/assets/domain/illustration.js";
import { makeWhitePixelsTransparent } from "../deployment/qcm-extractor-site/public/assets/pdf/extractIllustrations.js";

const rgbaPixels = new Uint8ClampedArray([
  255, 255, 255, 255,
  249, 250, 255, 255,
  20, 30, 40, 255
]);
makeWhitePixelsTransparent(rgbaPixels);
assert.deepEqual(
  [rgbaPixels[3], rgbaPixels[7], rgbaPixels[11]],
  [0, 255, 255],
  "Seuls les pixels blancs ou presque blancs doivent devenir transparents."
);

const documentMap = {
  schema_version: "1.0.0",
  document: {
    title: "Électricité",
    language: "fr",
    document_type: "slides",
    page_count: 6,
    warnings: []
  },
  question_segments: [
    {
      temporary_id: "segment-001",
      question_number: "1",
      question_pages: [2],
      answer_pages: [],
      feedback_pages: [],
      contains_essential_image: true,
      question_type_hint: "single_choice",
      page_regions: [
        {
          client_id: "segment-001-user-image",
          page: 2,
          role: "essential_image",
          bbox: { x: 0.51, y: 0.22, width: 0.37, height: 0.54 },
          origin: "user"
        }
      ],
      confidence: 0.96,
      warnings: []
    }
  ]
};

const questions = [
  {
    id: "q-001",
    segment_id: "segment-001",
    type: "single_choice",
    title: { content: "Ampoule et courant", origin: "generated_by_model" },
    content_format: "markdown-latex",
    statement: "Quand l’ampoule éclaire :\n\n(asset:001-01)",
    choices: [
      { id: "choice-a", content: "Elle prend du courant" },
      { id: "choice-b", content: "Elle donne du courant" }
    ],
    correct_choice_ids: [],
    correct_answer_origin: "not_available",
    feedback: { content: "", origin: "not_available" },
    images: [
      {
        id: "asset-001-01",
        role: "essential",
        source_page: 2,
        bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
        alt_text: "Circuit avec une pile et une ampoule",
        insertion_token: "asset:001-01"
      }
    ],
    source_pages: [2],
    confidence: 0.94,
    warnings: [],
    status: "draft"
  }
];

const plan = createIllustrationPlan(documentMap, questions);
assert.equal(plan.candidates.length, 1);
const candidate = plan.candidates[0];
assert.ok(candidate);
assert.deepEqual(
  candidate.bbox,
  documentMap.question_segments[0].page_regions[0].bbox,
  "Le découpage doit utiliser la zone corrigée dans la cartographie, pas la bbox du LLM."
);
assert.equal(candidate.id, "asset-001-01");
assert.equal(candidate.insertionToken, "asset:001-01");
assert.equal(candidate.altText, "Circuit avec une pile et une ampoule");
assert.equal(candidate.regionOrigin, "user");
assert.equal(candidate.statementContainsToken, true);
assert.equal(candidate.fileName, "q-001-01.png");
assert.equal(plan.fingerprint.includes("0.510000"), true);

console.log("OK plan d’illustrations : zones utilisateur prioritaires et métadonnées associées");
