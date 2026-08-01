import assert from "node:assert/strict";
import {
  createReviewExport,
  createReviewQuestions,
  reviewQuestionIssues
} from "../deployment/qcm-extractor-site/public/assets/domain/review.js";

const extracted = [{
  id: "q-001",
  segment_id: "segment-001",
  type: "single_choice",
  title: { content: "Ampoule", origin: "explicit_in_document" },
  content_format: "markdown-latex",
  statement: "Observer le circuit. asset:001",
  choices: [{ id: "a", content: "Réponse A" }, { id: "b", content: "Réponse B" }],
  correct_choice_ids: ["a"],
  correct_answer_origin: "explicit_in_document",
  feedback: { content: "Explication", origin: "explicit_in_document" },
  images: [],
  source_pages: [2],
  confidence: 0.9,
  warnings: [],
  status: "draft"
}];

const questions = createReviewQuestions(extracted);
assert.equal(questions.length, 1);
assert.deepEqual(questions[0].choices.map((choice) => choice.id), ["choice-a", "choice-b"]);
assert.deepEqual(questions[0].correctChoiceIds, ["choice-a"]);
assert.deepEqual(reviewQuestionIssues(questions[0]), []);

const reviewed = [{ ...questions[0], validated: true }];
const pdf = {
  fileName: "test.pdf",
  title: "Test",
  bytes: new Uint8Array([37, 80, 68, 70]).buffer
};
const documentMap = {
  document: { title: "Document", language: "fr" }
};
const plan = {
  candidates: [{
    id: "asset-001",
    segmentId: "segment-001",
    regionId: "region-001",
    questionId: "q-001",
    questionLabel: "Ampoule",
    role: "essential",
    sourcePage: 2,
    bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    regionOrigin: "user",
    altText: "Circuit",
    insertionToken: "asset:001",
    statementContainsToken: true,
    fileName: "q-001-01.png",
    warnings: []
  }]
};
const exported = await createReviewExport(pdf, documentMap, reviewed, plan, {});
assert.equal(exported.questions[0].statement, "Observer le circuit. ![Circuit](assets/q-001-01.png)");
assert.equal(exported.questions[0].assets[0].path, "assets/q-001-01.png");
assert.equal(exported.questions[0].validation_status, "validated");
assert.match(exported.document.source_sha256, /^[a-f0-9]{64}$/);
console.log("OK phase 7 review");
