import {
  createManualDocumentMap,
  createUserQuestionSegment
} from "../deployment/qcm-extractor-site/public/assets/domain/manualMapping.js";

const documentMap = createManualDocumentMap("Document manuel", 12);
if (documentMap.document.page_count !== 12 || documentMap.question_segments.length !== 0) {
  throw new Error("La carte manuelle vide n’est pas correctement initialisée.");
}

const segment = createUserQuestionSegment("1", 4);
if (
  !segment.temporary_id.startsWith("segment-manual-") ||
  segment.question_number !== "1" ||
  segment.question_pages[0] !== 4 ||
  segment.page_regions.length !== 0
) {
  throw new Error("La question manuelle n’est pas correctement initialisée.");
}

console.log("OK cartographie manuelle : carte et question initialisées localement");
