import { useMemo } from "react";
import type { BatchPlan, PlannedBatch } from "../domain/batchPlan";
import type {
  ExtractionSettings,
  ExtractionState
} from "../domain/projectState";
import type { DocumentMap } from "../domain/documentMap";
import {
  mergeExtractionResults,
  type CompletedBatchExtraction
} from "../domain/extraction";
import {
  CheckIcon,
  LayersIcon,
  ResetIcon,
  SparklesIcon,
  StopIcon,
  WarningIcon
} from "./Icons";

interface ExtractionPanelProps {
  readonly documentMap: DocumentMap;
  readonly plan: BatchPlan | null;
  readonly extraction: ExtractionState;
  readonly onSettingsChange: (settings: ExtractionSettings) => void;
  readonly onExtractAll: () => void;
  readonly onExtractBatch: (batchId: string) => void;
  readonly onCancel: () => void;
  readonly onClear: () => void;
  readonly onSelectSegment: (segmentId: string) => void;
}

function numericValue(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): number {
  return Number.parseInt(event.target.value, 10) || 0;
}

function statusLabel(status: string): string {
  switch (status) {
    case "preparing": return "Préparation…";
    case "uploading": return "Transmission…";
    case "queued": return "En attente…";
    case "in_progress": return "Analyse…";
    case "completed": return "Terminé";
    case "failed": return "Échec";
    case "cancelled": return "Annulé";
    default: return "À extraire";
  }
}

function statusClass(status: string): string {
  if (["preparing", "uploading", "queued", "in_progress"].includes(status)) {
    return "batch-status batch-status--running";
  }
  if (status === "completed") return "batch-status batch-status--ready";
  if (status === "failed") return "batch-status batch-status--error";
  if (status === "cancelled") return "batch-status batch-status--warning";
  return "batch-status";
}

function extractionStageText(batchState: ExtractionState["batches"][string] | undefined): string | null {
  if (batchState?.progress === null || batchState?.progress === undefined) return null;
  if (batchState.progress.providerStatus === "queued") {
    return `File fournisseur · interrogation ${batchState.progress.pollCount}`;
  }
  if (batchState.progress.providerStatus === "in_progress") {
    return `Analyse fournisseur · interrogation ${batchState.progress.pollCount}`;
  }
  return "Transmission du sous-PDF";
}

function batchQuestionCount(batchId: string, extraction: ExtractionState): number {
  return extraction.batches[batchId]?.result?.questions.length ?? 0;
}

export function ExtractionPanel({
  documentMap,
  plan,
  extraction,
  onSettingsChange,
  onExtractAll,
  onExtractBatch,
  onCancel,
  onClear,
  onSelectSegment
}: ExtractionPanelProps): React.ReactElement {
  const running = extraction.runStatus === "running";
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
  const failedCount = plannedBatches.filter(
    (batch) => extraction.batches[batch.id]?.status === "failed"
  ).length;
  const allCompleted = plannedBatches.length > 0 && completedCount === plannedBatches.length;

  const updateSetting = <TKey extends keyof ExtractionSettings>(
    key: TKey,
    value: ExtractionSettings[TKey]
  ): void => onSettingsChange({ ...extraction.settings, [key]: value });

  return (
    <aside className="mapping-panel extraction-panel" aria-label="Seconde passe d’extraction">
      <div className="mapping-panel__header">
        <div>
          <span className="eyebrow">Phase 5</span>
          <h2>Extraire les QCM</h2>
        </div>
        <span className="mapping-complete-badge"><SparklesIcon /> LLM</span>
      </div>

      <p className="batch-panel__intro">
        Chaque sous-PDF est transmis au proxy sans stockage persistant. Les résultats sont validés puis fusionnés dans l’ordre du document.
      </p>

      {plan === null ? (
        <div className="batch-empty-state">
          <LayersIcon />
          <strong>Aucun lot disponible</strong>
          <span>Planifiez d’abord les lots dans l’onglet précédent.</span>
        </div>
      ) : (
        <>
          <section className="extraction-settings" aria-label="Paramètres d’extraction">
            <label>
              <span>Lots simultanés</span>
              <select
                disabled={running}
                onChange={(event) => updateSetting("maxConcurrentBatches", numericValue(event))}
                value={extraction.settings.maxConcurrentBatches}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label>
              <span>Nouvelles tentatives</span>
              <select
                disabled={running}
                onChange={(event) => updateSetting("maxRetries", numericValue(event))}
                value={extraction.settings.maxRetries}
              >
                <option value={0}>Aucune</option>
                <option value={1}>1 tentative</option>
                <option value={2}>2 tentatives</option>
              </select>
            </label>
          </section>

          <div className="batch-actions">
            <button
              className="button button--primary"
              disabled={running || allCompleted || plannedBatches.length === 0}
              onClick={onExtractAll}
              type="button"
            >
              {allCompleted ? <CheckIcon /> : <SparklesIcon />}
              {allCompleted ? "Extraction terminée" : "Extraire tous les lots"}
            </button>
            {running ? (
              <button className="button button--danger" onClick={onCancel} type="button">
                <StopIcon /> Annuler
              </button>
            ) : (
              <button
                className="button button--secondary"
                disabled={completedResults.length === 0 && failedCount === 0}
                onClick={onClear}
                type="button"
              >
                <ResetIcon /> Effacer
              </button>
            )}
          </div>

          <dl className="batch-summary extraction-summary">
            <div><dt>Lots terminés</dt><dd>{completedCount}/{plannedBatches.length}</dd></div>
            <div><dt>Questions fusionnées</dt><dd>{merged.questions.length}</dd></div>
            <div><dt>Segments manquants</dt><dd>{merged.missingSegmentIds.length}</dd></div>
            <div><dt>Lots en échec</dt><dd>{failedCount}</dd></div>
          </dl>

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

          <div className="batch-list extraction-batch-list" aria-label="État des extractions">
            {plannedBatches.map((batch: PlannedBatch) => {
              const batchState = extraction.batches[batch.id];
              const status = batchState?.status ?? "idle";
              const progressText = extractionStageText(batchState);
              const questionCount = batchQuestionCount(batch.id, extraction);
              return (
                <article className="batch-card extraction-card" key={batch.id}>
                  <header className="batch-card__header">
                    <div>
                      <strong>Lot {batch.sequence}</strong>
                      <span>{batch.segmentIds.length} segment{batch.segmentIds.length > 1 ? "s" : ""}</span>
                    </div>
                    <span className={statusClass(status)}>{statusLabel(status)}</span>
                  </header>

                  <dl className="batch-card__meta">
                    <div><dt>Tentatives</dt><dd>{batchState?.attempts ?? 0}</dd></div>
                    <div><dt>Questions</dt><dd>{questionCount}</dd></div>
                    <div><dt>Jetons</dt><dd>{batchState?.meta?.usage.total_tokens ?? "—"}</dd></div>
                  </dl>

                  {progressText !== null && <div className="extraction-progress-line">{progressText}</div>}
                  {batchState?.result?.warnings.map((warning) => (
                    <div className="batch-card__warning" key={warning}><WarningIcon /> {warning}</div>
                  ))}
                  {batchState?.error !== null && batchState?.error !== undefined && (
                    <div className="batch-card__error" role="alert">
                      <strong>{batchState.error.code}</strong><br />{batchState.error.message}
                    </div>
                  )}

                  <footer className="batch-card__actions">
                    <button
                      className="button button--secondary"
                      disabled={running}
                      onClick={() => onExtractBatch(batch.id)}
                      type="button"
                    >
                      <SparklesIcon /> {status === "completed" ? "Réextraire" : "Extraire ce lot"}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>

          {merged.questions.length > 0 && (
            <section className="extraction-preview" aria-label="Aperçu des questions extraites">
              <h3>Aperçu fusionné</h3>
              {merged.questions.map((question) => (
                <article key={question.id}>
                  <header>
                    <strong>{question.id}</strong>
                    <button onClick={() => onSelectSegment(question.segment_id)} type="button">
                      {question.segment_id}
                    </button>
                  </header>
                  <p>{question.title.content || question.statement.slice(0, 180)}</p>
                  <small>
                    {question.choices.length} proposition{question.choices.length > 1 ? "s" : ""} · réponse {question.correct_answer_origin.replaceAll("_", " ")}
                  </small>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </aside>
  );
}
