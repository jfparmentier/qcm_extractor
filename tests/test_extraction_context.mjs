import assert from "node:assert/strict";
import { createExtractionContext } from "../deployment/qcm-extractor-site/public/assets/domain/extractionContext.js";

const batch = {
  id: "batch-001",
  segmentIds: ["segment-001"],
  originalPages: [4, 5],
  pageMap: [
    { localPage: 1, originalPage: 4, contextOnly: false },
    { localPage: 2, originalPage: 5, contextOnly: true }
  ],
  segmentReferences: [
    { segmentId: "segment-001", sourcePages: [4], localPages: [1] }
  ]
};
const documentMap = {
  question_segments: [{
    temporary_id: "segment-001",
    question_number: "Q1",
    question_type_hint: "single_choice",
    contains_essential_image: true,
    page_regions: [{
      page: 4,
      role: "question",
      bbox: { x: 0.1234567, y: 0.2, width: 0.7, height: 0.3 }
    }]
  }]
};
const context = createExtractionContext(batch, documentMap);
assert.equal(context.batch_id, "batch-001");
assert.deepEqual(context.local_to_original_page_map, [4, 5]);
assert.deepEqual(context.segments[0].local_pages, [1]);
assert.deepEqual(context.segments[0].regions[0].bbox, [0.12346, 0.2, 0.7, 0.3]);
console.log("OK contexte compact de seconde passe");
