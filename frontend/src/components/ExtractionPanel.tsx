import { useEffect, useMemo, useState } from "react";
import type { BatchPlan } from "../domain/batchPlan";
import type { ExtractionState } from "../domain/projectState";
import type { DocumentMap } from "../domain/documentMap";
import {
  mergeExtractionResults,
  type CompletedBatchExtraction
} from "../domain/extraction";
import {
  CheckIcon,
  LayersIcon,
  SparklesIcon,
  StopIcon,
  WarningIcon
} from "./Icons";

interface ExtractionPanelProps {
  readonly documentMap: DocumentMap;
  readonly plan: BatchPlan | null;
  readonly extraction: ExtractionState;
  readonly onExtractAll: () => void;
  readonly onCancel: () => void;
  readonly onSelectSegment: (segmentId: string) => void;
}

function formatElapsed(startedAt: number | null, endedAt: number): string {
  if (startedAt === null) return "—";
  const seconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`
    : `${seconds} s`;
}

function isRunningStatus(status: string): boolean {
  return ["preparing", "uploading", "queued", "in_progress"].includes(status);
}

function activeStatus(extraction: ExtractionState): string | null {
  const statuses = Object.values(extraction.batches).map((batch) => batch.status);
  for (const candidate of ["in_progress", "queued", "uploading", "preparing"] as const) {
    if (statuses.includes(candidate)) return candidate;
  }
  return null;
}

function statusLabel(
  extraction: ExtractionState,
  allCompleted: boolean,
  failedCount: number
): string {
  if (extraction.runStatus === "running") {
    switch (activeStatus(extraction)) {
      case "in_progress": return "Analyse des QCM par le LLM";
      case "queued": return "Analyse placée en file d’attente";
      case "uploading": return "Transmission sécurisée d’un sous-PDF";
      case "preparing": return "Préparation du prochain lot";
      default: return "Initialisation de l’extraction";
    }
  }
  if (allCompleted) return "Extraction terminée";
  if (failedCount > 0) return "Extraction incomplète";
  if (extraction.runStatus === "cancelled") return "Extraction annulée";
  return "Prête à démarrer";
}

function extractionStart(extraction: ExtractionState): number | null {
  if (extraction.startedAt !== null) return extraction.startedAt;
  const values = Object.values(extraction.batches)
    .map((batch) => batch.startedAt)
    .filter((value): value is number => value !== null);
  return values.length > 0 ? Math.min(...values) : null;
}

function extractionEnd(extraction: ExtractionState, now: number): number {
  if (extraction.runStatus === "running") return now;
  const values = Object.values(extraction.batches)
    .map((batch) => batch.completedAt)
    .filter((value): value is number => value !== null);
  return values.length > 0 ? Math.max(...values) : now;
}

export function ExtractionPanel({
  documentMap,
  plan,
  extraction,
  onExtractAll,
  onCancel,
  onSelectSegment
}: ExtractionPanelProps): React.ReactElement {
  const [now, setNow] = useState(Date.now());
  const running = extraction.runStatus === "running";

  useEffect(() => {
    setNow(Date.now());
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const completedResults = useMemo<CompletedBatchExtraction[]>(() =>
    Object.entries(extraction.batches).flatMap(([batchId, state]) =>
      state.status === "completed" && state.result !== null && state.meta !== null
        ? [{ batchId, result: state.result, meta: state.meta }]
        : []
    ), [extraction.batches]);
  const merged = useMemo(
    () => mergeExtractionResults(documentMap, completedResults),
    [completedResults, documentMap]
  );
  const plannedBatches = plan?.batches ?? [];
  const completedCount = plannedBatches.filter(
    (batch) => extraction.batches[batch.id]?.status === "completed"
  ).length;
  const failedBatches = plannedBatches.filter(
    (batch) => extraction.batches[batch.id]?.status === "failed"
  );
  const cancelledCount = plannedBatches.filter(
    (batch) => extraction.batches[batch.id]?.status === "cancelled"
  ).length;
  const processedCount = completedCount + failedBatches.length + cancelledCount;
  const allCompleted = plannedBatches.length > 0 && completedCount === plannedBatches.length;
  const startedAt = extractionStart(extraction);
  const elapsed = formatElapsed(startedAt, extractionEnd(extraction, now));
  const currentStatus = statusLabel(extraction, allCompleted, failedBatches.length);
  const activeBatch = plannedBatches.find(
    (batch) => isRunningStatus(extraction.batches[batch.id]?.status ?? "idle")
  );
  const activeProgress = activeBatch === undefined
    ? null
    : extraction.batches[activeBatch.id]?.progress ?? null;

  return (
    <aside className="mapping-panel extraction-panel" aria-label="Extraction des QCM">
      <div className="mapping-panel__header">
        <div><h2>Extraire les QCM</h2></div>
        <span className="mapping-complete-badge"><SparklesIcon /> LLM</span>
      </div>

      {plan === null ? (
        <div className="batch-empty-state">
          <LayersIcon />
          <strong>Aucun lot disponible</strong>
          <span>La préparation automatique des lots doit être terminée avant l’extraction.</span>
        </div>
      ) : (
        <>
          <div className={`mapping-status-icon${running ? " mapping-status-icon--running" : ""}`}>
            {running
              ? <span className="loading-spinner loading-spinner--small" aria-hidden="true" />
              : allCompleted
                ? <CheckIcon />
                : failedBatches.length > 0
                  ? <WarningIcon />
                  : <SparklesIcon />}
          </div>

          {running && <div className="mapping-progress" aria-hidden="true"><span /></div>}

          <dl className="mapping-facts extraction-facts">
            <div><dt>État</dt><dd>{currentStatus}</dd></div>
            <div><dt>Temps écoulé</dt><dd>{elapsed}</dd></div>
            <div><dt>Lots traités</dt><dd>{processedCount}/{plannedBatches.length}</dd></div>
            <div><dt>Questions extraites</dt><dd>{merged.questions.length}</dd></div>
            {activeProgress !== null && (
              <div>
                <dt>Suivi</dt>
                <dd>Interrogation {activeProgress.pollCount}</dd>
              </div>
            )}
          </dl>

          {failedBatches.length > 0 && (
            <section className="extraction-errors" role="alert">
              <strong><WarningIcon /> {failedBatches.length} lot{failedBatches.length > 1 ? "s" : ""} en échec</strong>
              <ul>
                {failedBatches.map((batch) => {
                  const error = extraction.batches[batch.id]?.error;
                  return <li key={batch.id}>Lot {batch.sequence} : {error?.message ?? "échec non détaillé"}</li>;
                })}
              </ul>
            </section>
          )}

          {merged.missingSegmentIds.length > 0 && completedResults.length > 0 && (
            <div className="extraction-missing" role="status">
              <div><WarningIcon /><strong>Questions encore manquantes</strong></div>
              <div className="batch-card__segments">
                {merged.missingSegmentIds.map((segmentId) => (
                  <button key={segmentId} onClick={() => onSelectSegment(segmentId)} type="button">
                    {segmentId}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="batch-actions extraction-actions">
            {running ? (
              <button className="button button--danger" onClick={onCancel} type="button">
                <StopIcon /> Annuler
              </button>
            ) : (
              <button
                className="button button--primary"
                disabled={allCompleted || plannedBatches.length === 0}
                onClick={onExtractAll}
                type="button"
              >
                <SparklesIcon /> Extraire les QCM
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
