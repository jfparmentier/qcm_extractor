import { useEffect, useMemo, useState } from "react";
import type { MappingState } from "../domain/projectState";
import {
  getDocumentTypeLabel,
  getQuestionTypeLabel,
  getSegmentDisplayName
} from "../domain/documentMap";
import { CheckIcon, ImageIcon, SparklesIcon, StopIcon, WarningIcon } from "./Icons";

interface MappingPanelProps {
  readonly mapping: MappingState;
  readonly onAnalyze: () => void;
  readonly onCancel: () => void;
  readonly onSelectSegment: (segmentId: string) => void;
}

function formatElapsed(startedAt: number | null, now: number): string {
  if (startedAt === null) {
    return "";
  }

  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s` : `${seconds} s`;
}

function formatTokens(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("fr-FR").format(value);
}

export function MappingPanel({
  mapping,
  onAnalyze,
  onCancel,
  onSelectSegment
}: MappingPanelProps): React.ReactElement {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (mapping.status !== "running") {
      return undefined;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mapping.status]);

  const selectedIndex = useMemo(
    () =>
      mapping.data?.question_segments.findIndex(
        (segment) => segment.temporary_id === mapping.selectedSegmentId
      ) ?? -1,
    [mapping.data, mapping.selectedSegmentId]
  );

  if (mapping.status === "running") {
    return (
      <aside className="mapping-panel mapping-panel--status" aria-live="polite" aria-busy="true">
        <div className="mapping-status-icon mapping-status-icon--running">
          <span className="loading-spinner loading-spinner--small" aria-hidden="true" />
        </div>
        <span className="eyebrow">Première passe</span>
        <h2>Cartographie du document</h2>
        <p>
          Le PDF est transmis au proxy PHP, puis analysé par le LLM pour localiser les
          questions, corrections et illustrations.
        </p>
        <div className="mapping-progress" aria-hidden="true">
          <span />
        </div>
        <dl className="mapping-facts">
          <div><dt>État</dt><dd>Analyse en cours</dd></div>
          <div><dt>Temps écoulé</dt><dd>{formatElapsed(mapping.startedAt, now)}</dd></div>
        </dl>
        <button className="button button--secondary" onClick={onCancel} type="button">
          <StopIcon /> Annuler
        </button>
      </aside>
    );
  }

  if (mapping.status === "failed" && mapping.error !== null) {
    return (
      <aside className="mapping-panel mapping-panel--status" role="alert">
        <div className="mapping-status-icon mapping-status-icon--error"><WarningIcon /></div>
        <span className="eyebrow">Cartographie interrompue</span>
        <h2>{mapping.error.message}</h2>
        <p>
          {mapping.error.retryable
            ? "La requête peut être relancée. Aucun résultat partiel n’a été conservé."
            : "Vérifiez la configuration du proxy ou le document avant de relancer."}
        </p>
        {(mapping.error.technicalDetails !== undefined || mapping.error.requestId !== null) && (
          <details className="mapping-error-details">
            <summary>Détails techniques</summary>
            {mapping.error.technicalDetails !== undefined && <code>{mapping.error.technicalDetails}</code>}
            {mapping.error.requestId !== null && <code>Requête : {mapping.error.requestId}</code>}
          </details>
        )}
        <button className="button button--primary" onClick={onAnalyze} type="button">
          <SparklesIcon /> Relancer la cartographie
        </button>
      </aside>
    );
  }

  if (mapping.status !== "completed" || mapping.data === null) {
    return (
      <aside className="mapping-panel mapping-panel--status">
        <div className="mapping-status-icon"><SparklesIcon /></div>
        <span className="eyebrow">Première passe</span>
        <h2>Localiser les QCM</h2>
        <p>
          Lancez une analyse globale pour identifier les segments de questions et leurs
          pages sources avant l’extraction détaillée.
        </p>
        <button className="button button--primary" onClick={onAnalyze} type="button">
          <SparklesIcon /> Cartographier le PDF
        </button>
      </aside>
    );
  }

  const { document, question_segments: segments } = mapping.data;

  return (
    <aside className="mapping-panel" aria-label="Cartographie du document">
      <div className="mapping-panel__header">
        <div>
          <span className="eyebrow">Cartographie terminée</span>
          <h2>{segments.length} question{segments.length > 1 ? "s" : ""} détectée{segments.length > 1 ? "s" : ""}</h2>
        </div>
        <span className="mapping-complete-badge"><CheckIcon /> Prête</span>
      </div>

      <dl className="mapping-summary">
        <div><dt>Document</dt><dd>{document.title || "Sans titre"}</dd></div>
        <div><dt>Type</dt><dd>{getDocumentTypeLabel(document.document_type)}</dd></div>
        <div><dt>Langue</dt><dd>{document.language}</dd></div>
      </dl>

      {document.warnings.length > 0 && (
        <details className="mapping-warnings">
          <summary>{document.warnings.length} avertissement{document.warnings.length > 1 ? "s" : ""}</summary>
          <ul>
            {document.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </details>
      )}

      <div className="segment-list-heading">
        <span>Segments</span>
        <span>{selectedIndex >= 0 ? `${selectedIndex + 1} / ${segments.length}` : segments.length}</span>
      </div>

      <nav className="segment-list" aria-label="Questions détectées">
        {segments.length === 0 && (
          <p className="segment-list__empty">Aucun QCM n’a été identifié dans ce document.</p>
        )}
        {segments.map((segment, index) => {
          const selected = segment.temporary_id === mapping.selectedSegmentId;
          return (
            <button
              key={segment.temporary_id}
              aria-current={selected ? "true" : undefined}
              className={`segment-card${selected ? " segment-card--selected" : ""}`}
              onClick={() => onSelectSegment(segment.temporary_id)}
              type="button"
            >
              <span className="segment-card__index">{index + 1}</span>
              <span className="segment-card__body">
                <strong>{getSegmentDisplayName(segment, index)}</strong>
                <span>{getQuestionTypeLabel(segment.question_type_hint)}</span>
                <span className="segment-card__meta">
                  Page{segment.question_pages.length > 1 ? "s" : ""} {segment.question_pages.join(", ")}
                  {segment.contains_essential_image && <><span aria-hidden="true"> · </span><ImageIcon /> Illustration</>}
                </span>
                {segment.warnings.length > 0 && (
                  <span className="segment-card__warning"><WarningIcon /> À vérifier</span>
                )}
              </span>
              <span className="segment-card__confidence" title="Confiance du modèle">
                {Math.round(segment.confidence * 100)} %
              </span>
            </button>
          );
        })}
      </nav>

      <footer className="mapping-panel__footer">
        <div className="mapping-usage">
          <span>Modèle : {mapping.meta?.model ?? "—"}</span>
          <span>Jetons : {formatTokens(mapping.meta?.usage.total_tokens ?? null)}</span>
        </div>
        <button className="button button--secondary button--full" onClick={onAnalyze} type="button">
          <SparklesIcon /> Relancer l’analyse
        </button>
      </footer>
    </aside>
  );
}
