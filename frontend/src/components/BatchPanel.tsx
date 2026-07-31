import { useMemo } from "react";
import type { BatchPreparationState } from "../domain/projectState";
import {
  BATCH_SETTING_LIMITS,
  formatPageRanges,
  type BatchSettings,
  type PlannedBatch
} from "../domain/batchPlan";
import type { DocumentMap } from "../domain/documentMap";
import { formatFileSize } from "../pdf/formatFileSize";
import {
  CheckIcon,
  DownloadIcon,
  LayersIcon,
  ResetIcon,
  SparklesIcon,
  WarningIcon
} from "./Icons";

interface BatchPanelProps {
  readonly batching: BatchPreparationState;
  readonly documentMap: DocumentMap;
  readonly onSettingsChange: (settings: BatchSettings) => void;
  readonly onPlan: () => void;
  readonly onGenerateBatch: (batchId: string) => void;
  readonly onGenerateAll: () => void;
  readonly onDownloadBatch: (batchId: string) => void;
  readonly onSelectSegment: (segmentId: string) => void;
  readonly onClear: () => void;
}

function numericValue(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): number {
  return Number.parseInt(event.target.value, 10) || 0;
}

function batchStatusLabel(
  batch: PlannedBatch,
  batching: BatchPreparationState
): { readonly label: string; readonly className: string } {
  if (batching.activeBatchId === batch.id) {
    return { label: "Génération…", className: "batch-status batch-status--running" };
  }
  if (batching.artifacts[batch.id] !== undefined) {
    return { label: "Prêt", className: "batch-status batch-status--ready" };
  }
  if (batching.errors[batch.id] !== undefined) {
    return { label: "Échec", className: "batch-status batch-status--error" };
  }
  if (batch.oversized) {
    return { label: "À vérifier", className: "batch-status batch-status--warning" };
  }
  return { label: "Planifié", className: "batch-status" };
}

export function BatchPanel({
  batching,
  documentMap,
  onSettingsChange,
  onPlan,
  onGenerateBatch,
  onGenerateAll,
  onDownloadBatch,
  onSelectSegment,
  onClear
}: BatchPanelProps): React.ReactElement {
  const plan = batching.plan;
  const isGenerating = batching.activeBatchId !== null;
  const generatedCount = Object.keys(batching.artifacts).length;
  const allGenerated = plan !== null && plan.batches.length > 0 && generatedCount === plan.batches.length;
  const segmentIndex = useMemo(
    () => new Map(documentMap.question_segments.map((segment, index) => [segment.temporary_id, index + 1])),
    [documentMap.question_segments]
  );

  const updateSetting = <TKey extends keyof BatchSettings>(
    key: TKey,
    value: BatchSettings[TKey]
  ): void => {
    onSettingsChange({ ...batching.settings, [key]: value });
  };

  return (
    <aside className="mapping-panel batch-panel" aria-label="Découpage local et gestion des lots">
      <div className="mapping-panel__header">
        <div>
          <span className="eyebrow">Phase 4</span>
          <h2>Préparer les sous-PDF</h2>
        </div>
        <span className="mapping-complete-badge"><LayersIcon /> Local</span>
      </div>

      <p className="batch-panel__intro">
        Les pages sont copiées dans le navigateur. Aucun sous-PDF n’est envoyé au serveur pendant cette phase.
      </p>

      <section className="batch-settings" aria-label="Paramètres de regroupement">
        <label>
          <span>Questions par lot</span>
          <input
            max={BATCH_SETTING_LIMITS.maxQuestionsPerBatch.max}
            min={BATCH_SETTING_LIMITS.maxQuestionsPerBatch.min}
            onChange={(event) => updateSetting("maxQuestionsPerBatch", numericValue(event))}
            type="number"
            value={batching.settings.maxQuestionsPerBatch}
          />
        </label>
        <label>
          <span>Pages par lot</span>
          <input
            max={BATCH_SETTING_LIMITS.maxPagesPerBatch.max}
            min={BATCH_SETTING_LIMITS.maxPagesPerBatch.min}
            onChange={(event) => updateSetting("maxPagesPerBatch", numericValue(event))}
            type="number"
            value={batching.settings.maxPagesPerBatch}
          />
        </label>
        <label>
          <span>Contexte autour des pages</span>
          <select
            onChange={(event) => updateSetting("contextPaddingPages", numericValue(event))}
            value={batching.settings.contextPaddingPages}
          >
            <option value={0}>Aucune page</option>
            <option value={1}>1 page avant/après</option>
            <option value={2}>2 pages avant/après</option>
            <option value={3}>3 pages avant/après</option>
          </select>
        </label>
        <label>
          <span>Écart maximal entre segments</span>
          <input
            max={BATCH_SETTING_LIMITS.maxGapPages.max}
            min={BATCH_SETTING_LIMITS.maxGapPages.min}
            onChange={(event) => updateSetting("maxGapPages", numericValue(event))}
            type="number"
            value={batching.settings.maxGapPages}
          />
        </label>
        <label className="batch-settings__wide">
          <span>Taille estimée maximale</span>
          <select
            onChange={(event) => updateSetting("maxEstimatedBytes", numericValue(event))}
            value={batching.settings.maxEstimatedBytes}
          >
            <option value={6 * 1024 * 1024}>6 Mio</option>
            <option value={12 * 1024 * 1024}>12 Mio</option>
            <option value={20 * 1024 * 1024}>20 Mio</option>
            <option value={32 * 1024 * 1024}>32 Mio</option>
          </select>
        </label>
      </section>

      <div className="batch-actions">
        <button className="button button--primary" disabled={isGenerating} onClick={onPlan} type="button">
          <LayersIcon /> {plan === null ? "Planifier les lots" : "Recalculer"}
        </button>
        {plan !== null && (
          <button className="button button--secondary" disabled={isGenerating} onClick={onClear} type="button">
            <ResetIcon /> Effacer
          </button>
        )}
      </div>

      {plan === null ? (
        <div className="batch-empty-state">
          <LayersIcon />
          <strong>Aucun lot planifié</strong>
          <span>La cartographie corrigée sera regroupée par questions et pages voisines.</span>
        </div>
      ) : (
        <>
          <dl className="batch-summary">
            <div><dt>Lots</dt><dd>{plan.batches.length}</dd></div>
            <div><dt>Questions</dt><dd>{plan.totalSegments}</dd></div>
            <div><dt>Estimation</dt><dd>{formatFileSize(plan.totalEstimatedBytes)}</dd></div>
            <div><dt>Pages de contexte dupliquées</dt><dd>{plan.duplicatedContextPages}</dd></div>
          </dl>

          {plan.warnings.length > 0 && (
            <div className="batch-global-warning" role="status">
              <WarningIcon />
              <span>{plan.warnings.join(" ")}</span>
            </div>
          )}

          <button
            className="button button--primary button--full"
            disabled={isGenerating || allGenerated || plan.batches.length === 0}
            onClick={onGenerateAll}
            type="button"
          >
            {allGenerated ? <CheckIcon /> : <SparklesIcon />}
            {allGenerated ? "Tous les lots sont prêts" : `Générer les ${plan.batches.length} sous-PDF`}
          </button>

          <div className="batch-list" aria-label="Lots planifiés">
            {plan.batches.map((batch) => {
              const artifact = batching.artifacts[batch.id];
              const error = batching.errors[batch.id];
              const status = batchStatusLabel(batch, batching);
              return (
                <article className={`batch-card${batch.oversized ? " batch-card--warning" : ""}`} key={batch.id}>
                  <header className="batch-card__header">
                    <div>
                      <strong>Lot {batch.sequence}</strong>
                      <span>{batch.segmentIds.length} question{batch.segmentIds.length > 1 ? "s" : ""}</span>
                    </div>
                    <span className={status.className}>{status.label}</span>
                  </header>

                  <dl className="batch-card__meta">
                    <div><dt>Pages originales</dt><dd>{formatPageRanges(batch.originalPages)}</dd></div>
                    <div><dt>Pages du sous-PDF</dt><dd>{batch.originalPages.length}</dd></div>
                    <div><dt>Taille</dt><dd>{artifact === undefined ? `≈ ${formatFileSize(batch.estimatedBytes)}` : formatFileSize(artifact.actualBytes)}</dd></div>
                  </dl>

                  <div className="batch-card__segments" aria-label="Questions du lot">
                    {batch.segmentIds.map((segmentId) => (
                      <button key={segmentId} onClick={() => onSelectSegment(segmentId)} type="button">
                        Q{segmentIndex.get(segmentId) ?? "?"}
                      </button>
                    ))}
                  </div>

                  <details className="batch-page-map">
                    <summary>Correspondance des pages</summary>
                    <ol>
                      {batch.pageMap.map((entry) => (
                        <li className={entry.contextOnly ? "batch-page-map__context" : ""} key={entry.localPage}>
                          <span>Locale {entry.localPage}</span>
                          <span>Originale {entry.originalPage}</span>
                          {entry.contextOnly && <small>contexte</small>}
                        </li>
                      ))}
                    </ol>
                  </details>

                  {batch.warnings.map((warning) => (
                    <div className="batch-card__warning" key={warning}><WarningIcon /> {warning}</div>
                  ))}
                  {error !== undefined && (
                    <div className="batch-card__error" role="alert">{error}</div>
                  )}

                  <footer className="batch-card__actions">
                    <button
                      className="button button--secondary"
                      disabled={isGenerating}
                      onClick={() => onGenerateBatch(batch.id)}
                      type="button"
                    >
                      <SparklesIcon /> {artifact === undefined ? "Générer" : "Régénérer"}
                    </button>
                    <button
                      className="button button--secondary"
                      disabled={artifact === undefined || isGenerating}
                      onClick={() => onDownloadBatch(batch.id)}
                      type="button"
                    >
                      <DownloadIcon /> Télécharger
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
