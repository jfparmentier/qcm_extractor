import { useMemo } from "react";
import type {
  IllustrationGenerationState,
  IllustrationPlan
} from "../domain/illustration";
import { illustrationRoleLabel } from "../domain/illustration";
import { formatFileSize } from "../pdf/formatFileSize";
import {
  CheckIcon,
  DownloadIcon,
  ImageIcon,
  ResetIcon,
  SparklesIcon,
  StopIcon,
  WarningIcon
} from "./Icons";

interface IllustrationPanelProps {
  readonly plan: IllustrationPlan;
  readonly generation: IllustrationGenerationState;
  readonly onGenerateAll: () => void;
  readonly onGenerateOne: (candidateId: string) => void;
  readonly onCancel: () => void;
  readonly onClear: () => void;
  readonly onDownload: (candidateId: string) => void;
  readonly onSelectSegment: (segmentId: string) => void;
  readonly onPageChange: (page: number) => void;
}

function generationStatusLabel(status: IllustrationGenerationState["status"]): string {
  switch (status) {
    case "running": return "Génération en cours";
    case "completed": return "Illustrations prêtes";
    case "failed": return "Génération incomplète";
    case "cancelled": return "Génération annulée";
    default: return "À générer";
  }
}

export function IllustrationPanel({
  plan,
  generation,
  onGenerateAll,
  onGenerateOne,
  onCancel,
  onClear,
  onDownload,
  onSelectSegment,
  onPageChange
}: IllustrationPanelProps): React.ReactElement {
  const generatedCount = Object.keys(generation.assets).length;
  const allGenerated = plan.candidates.length > 0 && generatedCount === plan.candidates.length;
  const totalBytes = useMemo(
    () => Object.values(generation.assets).reduce((sum, asset) => sum + asset.byteLength, 0),
    [generation.assets]
  );
  const progressPercent = allGenerated
    ? 100
    : generation.progress === null || generation.progress.total === 0
      ? 0
      : Math.round((generation.progress.completed / generation.progress.total) * 100);

  return (
    <aside className="mapping-panel illustration-panel" aria-label="Extraction locale des illustrations">
      <div className="mapping-panel__header">
        <div>
          <span className="eyebrow">Phase 6</span>
          <h2>Produire les illustrations</h2>
        </div>
        <span className="mapping-complete-badge"><ImageIcon /> Local</span>
      </div>

      <p className="batch-panel__intro">
        Les pages sont rendues en haute résolution dans le navigateur, puis découpées exactement selon les zones d’image déjà définies dans la cartographie.
      </p>

      {plan.candidates.length === 0 ? (
        <div className="batch-empty-state">
          <ImageIcon />
          <strong>Aucune illustration à produire</strong>
          <span>Aucune zone « illustration essentielle » ou « illustration décorative » n’est associée aux questions extraites.</span>
        </div>
      ) : (
        <>
          <dl className="batch-summary illustration-summary">
            <div><dt>Zones d’image</dt><dd>{plan.candidates.length}</dd></div>
            <div><dt>Questions</dt><dd>{plan.questionCount}</dd></div>
            <div><dt>PNG produits</dt><dd>{generatedCount}</dd></div>
            <div><dt>Taille totale</dt><dd>{generatedCount === 0 ? "—" : formatFileSize(totalBytes)}</dd></div>
          </dl>

          {plan.warnings.map((warning) => (
            <div className="batch-global-warning" key={warning}>
              <WarningIcon /> <span>{warning}</span>
            </div>
          ))}

          <div className="batch-actions illustration-actions">
            <button
              className="button button--primary"
              disabled={generation.status === "running" || allGenerated}
              onClick={onGenerateAll}
              type="button"
            >
              {allGenerated ? <CheckIcon /> : <SparklesIcon />}
              {allGenerated ? "Toutes les images sont prêtes" : "Générer toutes les images"}
            </button>
            {generation.status === "running" ? (
              <button className="button button--danger" onClick={onCancel} type="button">
                <StopIcon /> Annuler
              </button>
            ) : (
              <button
                className="button button--secondary"
                disabled={generatedCount === 0 && Object.keys(generation.errors).length === 0}
                onClick={onClear}
                type="button"
              >
                <ResetIcon /> Effacer
              </button>
            )}
          </div>

          <div className="illustration-generation-status" role="status">
            <div>
              <strong>{generationStatusLabel(generation.status)}</strong>
              <span>{generatedCount}/{plan.candidates.length}</span>
            </div>
            <div className="illustration-progress" aria-label={`Progression ${progressPercent} %`}>
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            {generation.progress?.currentPage !== null && generation.progress !== null && (
              <small>Page {generation.progress.currentPage} · {progressPercent} %</small>
            )}
          </div>

          <div className="illustration-list" aria-label="Illustrations détectées">
            {plan.candidates.map((candidate) => {
              const asset = generation.assets[candidate.id];
              const error = generation.errors[candidate.id];
              return (
                <article className="illustration-card" key={candidate.id}>
                  <header>
                    <div>
                      <strong>{candidate.questionLabel}</strong>
                      <span>{illustrationRoleLabel(candidate.role)} · page {candidate.sourcePage}</span>
                    </div>
                    <span className={asset === undefined ? "batch-status" : "batch-status batch-status--ready"}>
                      {asset === undefined ? "À produire" : "PNG prêt"}
                    </span>
                  </header>

                  <button
                    className="illustration-preview"
                    onClick={() => {
                      onSelectSegment(candidate.segmentId);
                      onPageChange(candidate.sourcePage);
                    }}
                    title="Afficher la zone source dans le PDF"
                    type="button"
                  >
                    {asset === undefined ? (
                      <span><ImageIcon /> Aperçu disponible après génération</span>
                    ) : (
                      <img alt={asset.altText} src={asset.previewUrl} />
                    )}
                  </button>

                  <dl className="illustration-card__meta">
                    <div><dt>Fichier</dt><dd>{candidate.fileName}</dd></div>
                    <div><dt>Dimensions</dt><dd>{asset === undefined ? "—" : `${asset.width} × ${asset.height} px`}</dd></div>
                    <div><dt>Taille</dt><dd>{asset === undefined ? "—" : formatFileSize(asset.byteLength)}</dd></div>
                    <div><dt>Jeton</dt><dd><code>{candidate.insertionToken}</code></dd></div>
                  </dl>

                  <p className="illustration-alt-text"><strong>Texte alternatif :</strong> {candidate.altText}</p>

                  {[...candidate.warnings, ...(asset?.generationWarnings ?? [])].map((warning) => (
                    <div className="batch-card__warning" key={warning}><WarningIcon /> {warning}</div>
                  ))}
                  {error !== undefined && <div className="batch-card__error" role="alert">{error}</div>}

                  <footer className="batch-card__actions">
                    <button
                      className="button button--secondary"
                      disabled={generation.status === "running"}
                      onClick={() => onGenerateOne(candidate.id)}
                      type="button"
                    >
                      <SparklesIcon /> {asset === undefined ? "Générer" : "Régénérer"}
                    </button>
                    <button
                      className="button button--secondary"
                      disabled={asset === undefined || generation.status === "running"}
                      onClick={() => onDownload(candidate.id)}
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
