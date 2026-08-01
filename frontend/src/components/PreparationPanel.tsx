import type { BatchPreparationState } from "../domain/projectState";
import { LayersIcon, ResetIcon, WarningIcon } from "./Icons";

interface PreparationPanelProps {
  readonly batching: BatchPreparationState;
  readonly error: string | null;
  readonly onRetry: () => void;
}

export function PreparationPanel({
  batching,
  error,
  onRetry
}: PreparationPanelProps): React.ReactElement {
  const total = batching.plan?.batches.length ?? 0;
  const generated = Object.keys(batching.artifacts).length;
  const activeSequence = batching.plan?.batches.find(
    (batch) => batch.id === batching.activeBatchId
  )?.sequence ?? null;

  if (error !== null) {
    return (
      <aside className="mapping-panel mapping-panel--status" role="alert">
        <div className="mapping-status-icon mapping-status-icon--error"><WarningIcon /></div>
        <span className="eyebrow">Préparation interrompue</span>
        <h2>Les sous-PDF n’ont pas tous été générés</h2>
        <p>{error}</p>
        <button className="button button--primary" onClick={onRetry} type="button">
          <ResetIcon /> Réessayer
        </button>
      </aside>
    );
  }

  return (
    <aside className="mapping-panel mapping-panel--status" aria-busy="true" aria-live="polite">
      <div className="mapping-status-icon mapping-status-icon--running">
        <span className="loading-spinner loading-spinner--small" aria-hidden="true" />
      </div>
      <span className="eyebrow">Phase 4</span>
      <h2>Préparation automatique des lots</h2>
      <p>Les pages utiles sont regroupées et les sous-PDF sont générés localement.</p>
      <div className="mapping-progress" aria-hidden="true"><span /></div>
      <dl className="mapping-facts">
        <div><dt>Lots planifiés</dt><dd>{total || "…"}</dd></div>
        <div><dt>Lots générés</dt><dd>{generated}/{total || "…"}</dd></div>
        <div><dt>Lot en cours</dt><dd>{activeSequence === null ? "Préparation" : activeSequence}</dd></div>
      </dl>
      <div className="preparation-note"><LayersIcon /> Aucun fichier n’est envoyé au serveur pendant cette étape.</div>
    </aside>
  );
}
