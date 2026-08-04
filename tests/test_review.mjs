import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createMoodleXml,
  createReviewArchive,
  createReviewExport,
  createReviewQuestions,
  exportFileName,
  getStatementRegionsForSegment,
  reviewQuestionIssues
} from "../deployment/qcm-extractor-site/public/assets/domain/review.js";

const extracted = [{
  id: "q-001",
  segment_id: "segment-001",
  type: "single_choice",
  title: { content: "Ampoule", origin: "explicit_in_document" },
  content_format: "markdown-latex",
  statement: "Observer le circuit. (asset:001)",
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
assert.equal(questions[0].feedback, "Explication");
assert.equal(questions[0].feedbackOrigin, "explicit_in_document");
const emptyFeedbackIssues = reviewQuestionIssues({
  ...questions[0],
  feedback: "",
  feedbackOrigin: "not_available"
});
assert.ok(emptyFeedbackIssues.includes("Le feedback pédagogique est vide."));

const generatedFeedback = createReviewQuestions([{
  ...extracted[0],
  id: "q-002",
  segment_id: "segment-002",
  feedback: {
    content: "Le modèle explique pourquoi la réponse A est correcte.",
    origin: "generated_by_model"
  }
}]);
assert.equal(generatedFeedback[0].feedbackOrigin, "generated_by_model");
assert.match(generatedFeedback[0].feedback, /réponse A/);

const statementRegions = getStatementRegionsForSegment({
  question_segments: [{
    temporary_id: "segment-multipage",
    page_regions: [
      { client_id: "image", page: 1, role: "essential_image", bbox: { x: 0.2, y: 0.1, width: 0.3, height: 0.2 } },
      { client_id: "page-2", page: 2, role: "question", bbox: { x: 0.1, y: 0.05, width: 0.8, height: 0.3 } },
      { client_id: "page-1-bottom", page: 1, role: "question", bbox: { x: 0.1, y: 0.82, width: 0.8, height: 0.12 } },
      { client_id: "page-1-top", page: 1, role: "question", bbox: { x: 0.1, y: 0.72, width: 0.8, height: 0.08 } }
    ]
  }]
}, "segment-multipage");
assert.deepEqual(
  statementRegions.map((region) => region.client_id),
  ["page-1-top", "page-1-bottom", "page-2"]
);

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
const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const generatedAssets = {
  "asset-001": {
    ...plan.candidates[0],
    blob: new Blob([pngBytes], { type: "image/png" }),
    previewUrl: "blob:test",
    width: 320,
    height: 180,
    byteLength: pngBytes.byteLength,
    mimeType: "image/png",
    generatedAt: Date.now(),
    generationWarnings: []
  }
};
const exported = await createReviewExport(pdf, documentMap, reviewed, plan, generatedAssets);
assert.equal(exported.questions[0].statement, "Observer le circuit.\n![Circuit](assets/q-001-01.png)");
assert.equal(exported.questions[0].assets[0].path, "assets/q-001-01.png");
assert.equal(exported.questions[0].validation_status, "validated");
assert.match(exported.document.source_sha256, /^[a-f0-9]{64}$/);
assert.equal(exportFileName("Mon document.pdf"), "Mon-document-qcm.zip");

const moodleXml = await createMoodleXml(exported, generatedAssets);
assert.match(moodleXml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<quiz>/);
assert.match(moodleXml, /<question type="multichoice">/);
assert.match(moodleXml, /<single>true<\/single>/);
assert.match(moodleXml, /<shuffleanswers>false<\/shuffleanswers>/);
assert.match(moodleXml, /<answernumbering>none<\/answernumbering>/);
assert.match(moodleXml, /<answer fraction="100" format="html">[\s\S]*Réponse A/);
assert.match(moodleXml, /<answer fraction="-100" format="html">[\s\S]*Réponse B/);
assert.match(moodleXml, /<img src="@@PLUGINFILE@@\/q-001-01\.png" alt="Circuit" style="max-width: 450px; max-height: 300px; width: auto; height: auto;" \/>/);
assert.match(moodleXml, /Observer le circuit\.<br \/>\n<img /);
assert.doesNotMatch(moodleXml, /Observer le circuit\.<br \/>\n<br \/>\n<img /);
assert.doesNotMatch(moodleXml, /<img[^>]+\/>\s*\)/);
assert.match(moodleXml, /<file name="q-001-01\.png" path="\/" encoding="base64">iVBORw0KGgo=<\/file>/);
assert.doesNotMatch(moodleXml, /!\[[^\]]*\]\([^)]*\)/);

const malformedImageMarkdownXml = await createMoodleXml({
  ...exported,
  questions: [{
    ...exported.questions[0],
    statement: "Observer le circuit. ![ancienne légende]( image )"
  }]
}, generatedAssets);
assert.doesNotMatch(malformedImageMarkdownXml, /!\[[^\]]*\]\([^)]*\)/);
assert.equal(
  [...malformedImageMarkdownXml.matchAll(/<img src="@@PLUGINFILE@@\/q-001-01\.png"/g)].length,
  1,
  "L’image doit être intégrée une seule fois même si son Markdown est invalide."
);

const orphanImageDescriptionXml = await createMoodleXml({
  ...exported,
  questions: [{
    ...exported.questions[0],
    statement: "Observer le circuit. ![description de l'image] ![Circuit](assets/q-001-01.png)"
  }]
}, generatedAssets);
assert.doesNotMatch(orphanImageDescriptionXml, /!\[description de l'image\]/);
assert.match(orphanImageDescriptionXml, /<img src="@@PLUGINFILE@@\/q-001-01\.png"/);

const multipleAnswersXml = await createMoodleXml({
  ...exported,
  questions: [{
    ...exported.questions[0],
    type: "multiple_choice",
    choices: [
      { id: "choice-a", content: "Première" },
      { id: "choice-b", content: "Deuxième" },
      { id: "choice-c", content: "Troisième" }
    ],
    correct_choice_ids: ["choice-a", "choice-c"]
  }]
}, generatedAssets);
assert.match(multipleAnswersXml, /<single>false<\/single>/);
assert.deepEqual(
  [...multipleAnswersXml.matchAll(/<answer fraction="([^"]+)" format="html">[\s\S]*?<text><!\[CDATA\[([^<]+)\]\]><\/text>/g)]
    .map((match) => [match[1], match[2]]),
  [["50", "Première"], ["-100", "Deuxième"], ["50", "Troisième"]]
);

const archive = await createReviewArchive(exported, plan, generatedAssets);
assert.equal(archive.type, "application/zip");
const archiveBytes = new Uint8Array(await archive.arrayBuffer());
assert.deepEqual([...archiveBytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);

const temporaryDirectory = mkdtempSync(join(tmpdir(), "qcm-review-"));
try {
  const archivePath = join(temporaryDirectory, "export.zip");
  writeFileSync(archivePath, archiveBytes);
  execFileSync("unzip", ["-t", archivePath], { stdio: "pipe" });
  const jsonText = execFileSync("unzip", ["-p", archivePath, "questions.json"], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(jsonText), exported);
  const xmlText = execFileSync("unzip", ["-p", archivePath, "questions.xml"], { encoding: "utf8" });
  assert.equal(xmlText, moodleXml);
  const extractedPng = execFileSync("unzip", ["-p", archivePath, "assets/q-001-01.png"]);
  assert.deepEqual([...extractedPng], [...pngBytes]);
  assert.ok(readFileSync(archivePath).byteLength > pngBytes.byteLength);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

await assert.rejects(
  () => createReviewArchive(exported, plan, {}),
  /n’a pas été générée/
);
console.log("OK phase 7 review ZIP");
