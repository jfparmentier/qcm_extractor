import type { ExtractionContext } from "../api/proxyClient";
import type { PlannedBatch } from "./batchPlan";
import type { DocumentMap, PageRegion } from "./documentMap";

function compactRegion(region: PageRegion, localPage: number) {
  return {
    source_page: region.page,
    local_page: localPage,
    role: region.role,
    bbox: [
      Number(region.bbox.x.toFixed(5)),
      Number(region.bbox.y.toFixed(5)),
      Number(region.bbox.width.toFixed(5)),
      Number(region.bbox.height.toFixed(5))
    ] as const
  };
}

export function createExtractionContext(
  batch: PlannedBatch,
  documentMap: DocumentMap
): ExtractionContext {
  const localPageByOriginal = new Map(
    batch.pageMap.map((entry) => [entry.originalPage, entry.localPage])
  );
  const segmentMap = new Map(
    documentMap.question_segments.map((segment) => [segment.temporary_id, segment])
  );

  return {
    batch_id: batch.id,
    segment_ids: batch.segmentIds,
    original_page_numbers: batch.originalPages,
    local_to_original_page_map: batch.pageMap.map((entry) => entry.originalPage),
    segment_page_map: Object.fromEntries(
      batch.segmentReferences.map((reference) => [reference.segmentId, reference.sourcePages])
    ),
    segments: batch.segmentIds.flatMap((segmentId) => {
      const segment = segmentMap.get(segmentId);
      if (segment === undefined) {
        return [];
      }

      const regions = segment.page_regions.flatMap((region) => {
        const localPage = localPageByOriginal.get(region.page);
        return localPage === undefined ? [] : [compactRegion(region, localPage)];
      });

      return [{
        id: segment.temporary_id,
        question_number: segment.question_number,
        question_type_hint: segment.question_type_hint,
        source_pages: batch.segmentReferences.find(
          (reference) => reference.segmentId === segment.temporary_id
        )?.sourcePages ?? [],
        local_pages: batch.segmentReferences.find(
          (reference) => reference.segmentId === segment.temporary_id
        )?.localPages ?? [],
        contains_essential_image: segment.contains_essential_image,
        regions
      }];
    })
  };
}
