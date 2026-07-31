import type { DocumentMap, QuestionSegment } from "./documentMap";

export interface BatchSettings {
  readonly maxQuestionsPerBatch: number;
  readonly maxPagesPerBatch: number;
  readonly maxEstimatedBytes: number;
  readonly contextPaddingPages: number;
  readonly maxGapPages: number;
}

export interface BatchPageMapEntry {
  readonly localPage: number;
  readonly originalPage: number;
  readonly contextOnly: boolean;
}

export interface SegmentBatchReference {
  readonly segmentId: string;
  readonly sourcePages: readonly number[];
  readonly localPages: readonly number[];
}

export interface PlannedBatch {
  readonly id: string;
  readonly sequence: number;
  readonly segmentIds: readonly string[];
  readonly originalPages: readonly number[];
  readonly requiredPages: readonly number[];
  readonly pageMap: readonly BatchPageMapEntry[];
  readonly segmentReferences: readonly SegmentBatchReference[];
  readonly estimatedBytes: number;
  readonly oversized: boolean;
  readonly warnings: readonly string[];
}

export interface BatchPlan {
  readonly createdAt: number;
  readonly settings: BatchSettings;
  readonly batches: readonly PlannedBatch[];
  readonly totalSegments: number;
  readonly totalEstimatedBytes: number;
  readonly duplicatedContextPages: number;
  readonly warnings: readonly string[];
}

export interface GeneratedBatchArtifact {
  readonly batchId: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly actualBytes: number;
  readonly generatedAt: number;
}

export const DEFAULT_BATCH_SETTINGS: BatchSettings = {
  maxQuestionsPerBatch: 8,
  maxPagesPerBatch: 14,
  maxEstimatedBytes: 12 * 1024 * 1024,
  contextPaddingPages: 1,
  maxGapPages: 2
};

export const BATCH_SETTING_LIMITS = {
  maxQuestionsPerBatch: { min: 1, max: 20 },
  maxPagesPerBatch: { min: 1, max: 40 },
  maxEstimatedBytes: { min: 1 * 1024 * 1024, max: 40 * 1024 * 1024 },
  contextPaddingPages: { min: 0, max: 3 },
  maxGapPages: { min: 0, max: 10 }
} as const;

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function normalizeBatchSettings(settings: BatchSettings): BatchSettings {
  return {
    maxQuestionsPerBatch: clampInteger(
      settings.maxQuestionsPerBatch,
      BATCH_SETTING_LIMITS.maxQuestionsPerBatch.min,
      BATCH_SETTING_LIMITS.maxQuestionsPerBatch.max
    ),
    maxPagesPerBatch: clampInteger(
      settings.maxPagesPerBatch,
      BATCH_SETTING_LIMITS.maxPagesPerBatch.min,
      BATCH_SETTING_LIMITS.maxPagesPerBatch.max
    ),
    maxEstimatedBytes: clampInteger(
      settings.maxEstimatedBytes,
      BATCH_SETTING_LIMITS.maxEstimatedBytes.min,
      BATCH_SETTING_LIMITS.maxEstimatedBytes.max
    ),
    contextPaddingPages: clampInteger(
      settings.contextPaddingPages,
      BATCH_SETTING_LIMITS.contextPaddingPages.min,
      BATCH_SETTING_LIMITS.contextPaddingPages.max
    ),
    maxGapPages: clampInteger(
      settings.maxGapPages,
      BATCH_SETTING_LIMITS.maxGapPages.min,
      BATCH_SETTING_LIMITS.maxGapPages.max
    )
  };
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function collectSegmentSourcePages(segment: QuestionSegment): readonly number[] {
  return uniqueSorted([
    ...segment.question_pages,
    ...segment.answer_pages,
    ...segment.feedback_pages,
    ...segment.page_regions.map((region) => region.page)
  ]);
}

function expandPages(
  pages: readonly number[],
  padding: number,
  pageCount: number
): readonly number[] {
  const expanded: number[] = [];
  for (const page of pages) {
    for (let candidate = page - padding; candidate <= page + padding; candidate += 1) {
      if (candidate >= 1 && candidate <= pageCount) {
        expanded.push(candidate);
      }
    }
  }
  return uniqueSorted(expanded);
}

function estimatePdfBytes(
  sourceBytes: number,
  sourcePageCount: number,
  selectedPageCount: number
): number {
  if (sourcePageCount <= 0 || selectedPageCount <= 0) {
    return 0;
  }

  // Les ressources partagées empêchent une estimation exacte avant la copie. Une marge
  // prudente couvre le catalogue, les polices et les flux réécrits par pdf-lib.
  const proportional = sourceBytes * (selectedPageCount / sourcePageCount);
  return Math.ceil(proportional * 1.25 + 96 * 1024);
}

function pageGap(leftPages: readonly number[], rightPages: readonly number[]): number {
  if (leftPages.length === 0 || rightPages.length === 0) {
    return 0;
  }
  const leftLast = leftPages[leftPages.length - 1] ?? 0;
  const rightFirst = rightPages[0] ?? leftLast;
  return Math.max(0, rightFirst - leftLast - 1);
}

interface SegmentCandidate {
  readonly segment: QuestionSegment;
  readonly sourcePages: readonly number[];
  readonly includedPages: readonly number[];
}

interface MutableBatch {
  readonly candidates: SegmentCandidate[];
  requiredPages: number[];
  originalPages: number[];
}

function makeMutableBatch(candidate: SegmentCandidate): MutableBatch {
  return {
    candidates: [candidate],
    requiredPages: [...candidate.sourcePages],
    originalPages: [...candidate.includedPages]
  };
}

function appendCandidate(batch: MutableBatch, candidate: SegmentCandidate): void {
  batch.candidates.push(candidate);
  batch.requiredPages = uniqueSorted([...batch.requiredPages, ...candidate.sourcePages]);
  batch.originalPages = uniqueSorted([...batch.originalPages, ...candidate.includedPages]);
}

function finalizeBatch(
  mutable: MutableBatch,
  sequence: number,
  sourceBytes: number,
  sourcePageCount: number,
  settings: BatchSettings
): PlannedBatch {
  const estimatedBytes = estimatePdfBytes(
    sourceBytes,
    sourcePageCount,
    mutable.originalPages.length
  );
  const oversized =
    mutable.candidates.length > settings.maxQuestionsPerBatch ||
    mutable.originalPages.length > settings.maxPagesPerBatch ||
    estimatedBytes > settings.maxEstimatedBytes;
  const warnings: string[] = [];

  if (mutable.originalPages.length > settings.maxPagesPerBatch) {
    warnings.push(
      `Ce lot contient ${mutable.originalPages.length} pages, au-delà de la limite de ${settings.maxPagesPerBatch}.`
    );
  }
  if (estimatedBytes > settings.maxEstimatedBytes) {
    warnings.push("La taille estimée dépasse la limite configurée ; le lot reste générable localement.");
  }
  if (mutable.requiredPages.length === 0) {
    warnings.push("Aucune page source n’est associée à ce lot.");
  }

  const pageMap = mutable.originalPages.map((originalPage, index) => ({
    localPage: index + 1,
    originalPage,
    contextOnly: !mutable.requiredPages.includes(originalPage)
  }));
  const localPageByOriginal = new Map(pageMap.map((entry) => [entry.originalPage, entry.localPage]));
  const segmentReferences = mutable.candidates.map(({ segment, sourcePages }) => ({
    segmentId: segment.temporary_id,
    sourcePages,
    localPages: sourcePages
      .map((page) => localPageByOriginal.get(page))
      .filter((page): page is number => page !== undefined)
  }));

  return {
    id: `batch-${sequence.toString().padStart(3, "0")}`,
    sequence,
    segmentIds: mutable.candidates.map(({ segment }) => segment.temporary_id),
    originalPages: mutable.originalPages,
    requiredPages: mutable.requiredPages,
    pageMap,
    segmentReferences,
    estimatedBytes,
    oversized,
    warnings
  };
}

export function createBatchPlan(
  documentMap: DocumentMap,
  sourceBytes: number,
  sourcePageCount: number,
  requestedSettings: BatchSettings
): BatchPlan {
  const settings = normalizeBatchSettings(requestedSettings);
  const candidates = documentMap.question_segments.map((segment) => {
    const sourcePages = collectSegmentSourcePages(segment);
    return {
      segment,
      sourcePages,
      includedPages: expandPages(sourcePages, settings.contextPaddingPages, sourcePageCount)
    } satisfies SegmentCandidate;
  });

  const mutableBatches: MutableBatch[] = [];
  let current: MutableBatch | null = null;

  for (const candidate of candidates) {
    if (current === null) {
      current = makeMutableBatch(candidate);
      continue;
    }

    const mergedPages = uniqueSorted([...current.originalPages, ...candidate.includedPages]);
    const mergedEstimatedBytes = estimatePdfBytes(sourceBytes, sourcePageCount, mergedPages.length);
    const gap = pageGap(current.originalPages, candidate.includedPages);
    const wouldOverflow =
      current.candidates.length + 1 > settings.maxQuestionsPerBatch ||
      mergedPages.length > settings.maxPagesPerBatch ||
      mergedEstimatedBytes > settings.maxEstimatedBytes ||
      gap > settings.maxGapPages;

    if (wouldOverflow) {
      mutableBatches.push(current);
      current = makeMutableBatch(candidate);
    } else {
      appendCandidate(current, candidate);
    }
  }

  if (current !== null) {
    mutableBatches.push(current);
  }

  const batches = mutableBatches.map((batch, index) =>
    finalizeBatch(batch, index + 1, sourceBytes, sourcePageCount, settings)
  );
  const allIncludedPages = batches.flatMap((batch) => batch.originalPages);
  const duplicatedContextPages = allIncludedPages.length - new Set(allIncludedPages).size;
  const warnings: string[] = [];

  if (batches.some((batch) => batch.oversized)) {
    warnings.push("Un ou plusieurs lots dépassent les limites configurées et nécessitent une vérification.");
  }
  if (documentMap.question_segments.length === 0) {
    warnings.push("Aucun segment n’est disponible pour constituer des lots.");
  }

  return {
    createdAt: Date.now(),
    settings,
    batches,
    totalSegments: documentMap.question_segments.length,
    totalEstimatedBytes: batches.reduce((total, batch) => total + batch.estimatedBytes, 0),
    duplicatedContextPages,
    warnings
  };
}

export function formatPageRanges(pages: readonly number[]): string {
  if (pages.length === 0) {
    return "—";
  }

  const sorted = uniqueSorted(pages);
  const ranges: string[] = [];
  let start = sorted[0] ?? 0;
  let previous = start;

  for (const page of sorted.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = page;
    previous = page;
  }
  ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
  return ranges.join(", ");
}

export function createBatchFilename(sourceFilename: string, batch: PlannedBatch): string {
  const base = sourceFilename.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "document";
  return `${base}-${batch.id}.pdf`;
}
