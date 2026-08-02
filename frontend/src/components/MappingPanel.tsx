import { useEffect, useMemo, useState } from "react";
import type { MappingState } from "../domain/projectState";
import {
  PAGE_REGION_ROLES,
  getPageRegionRoleLabel,
  getQuestionTypeLabel,
  getSegmentDisplayName,
  type PageRegionRole
} from "../domain/documentMap";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  PlusIcon,
  SelectionIcon,
  SparklesIcon,
  StopIcon,
  TrashIcon,
  WarningIcon
} from "./Icons";

interface MappingPanelProps {
  readonly mapping: MappingState;
  readonly currentPage: number;
  readonly drawingRole: PageRegionRole;
  readonly isDrawing: boolean;
  readonly onAnalyze: () => void;
  readonly onCancel: () => void;
  readonly onValidate: () => void;
  readonly onSelectSegment: (segmentId: string) => void;
  readonly onDeleteSegment: (segmentId: string) => void;
  readonly onSelectRegion: (segmentId: string, regionId: string) => void;
  readonly onDrawingRoleChange: (role: PageRegionRole) => void;
  readonly onToggleDrawing: () => void;
  readonly onUpdateRegionRole: (
    segmentId: string,
    regionId: string,
    role: PageRegionRole
  ) => void;
  readonly onDeleteRegion: (segmentId: string, regionId: string) => void;
}

function formatElapsed(startedAt: number | null, now: number): string {
  if (startedAt === null) return "";
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0
    ? `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`
    : `${seconds} s`;
}

function formatTokens(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("fr-FR").format(value);
}

function getRunningStatusLabel(mapping: MappingState): string {
  switch (mapping.progress?.providerStatus) {
    case "uploading": return "Transmission sécurisée du PDF";
    case "queued": return "Analyse placée en file d’attente";
    case "in_progress": return "Analyse du document par le LLM";
    default: return "Initialisation de l’analyse";
  }
}

export function MappingPanel({
  mapping,
  currentPage,
  drawingRole,
  isDrawing,
  onAnalyze,
  onCancel,
  onValidate,
  onSelectSegment,
  onDeleteSegment,
  onSelectRegion,
  onDrawingRoleChange,
  onToggleDrawing,
  onUpdateRegionRole,
  onDeleteRegion
}: MappingPanelProps): React.ReactElement {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (mapping.status !== "running") return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mapping.status]);

  const selectedIndex = useMemo(
    () => mapping.data?.question_segments.findIndex(
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
        <div className="mapping-progress" aria-hidden="true"><span /></div>
        <dl className="mapping-facts">
          <div><dt>État</dt><dd>{getRunningStatusLabel(mapping)}</dd></div>
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
  const selectedSegment = selectedIndex >= 0 ? segments[selectedIndex] ?? null : null;
  const selectedRegion = selectedSegment?.page_regions.find(
    (region) => region.client_id === mapping.selectedRegionId
  ) ?? null;
  const regionsOnCurrentPage = selectedSegment?.page_regions.filter(
    (region) => region.page === currentPage
  ) ?? [];
  const isLast = selectedIndex >= 0 && selectedIndex === segments.length - 1;

  if (segments.length === 0 || selectedSegment === null) {
    return (
      <aside className="mapping-panel mapping-panel--status">
        <div className="mapping-status-icon"><WarningIcon /></div>
        <span className="eyebrow">Cartographie terminée</span>
        <h2>Aucun QCM conservé</h2>
        <p>Relancez la cartographie pour détecter de nouvelles questions.</p>
        <button className="button button--primary" onClick={onAnalyze} type="button">
          <SparklesIcon /> Relancer l’analyse
        </button>
      </aside>
    );
  }

  const previousSegment = segments[selectedIndex - 1];
  const nextSegment = segments[selectedIndex + 1];

  return (
    <aside className="mapping-panel" aria-label="Validation de la cartographie question par question">
      <div className="mapping-panel__header mapping-panel__header--question">
        <div>
          <span className="eyebrow">Cartographie terminée</span>
          <h2>QCM {selectedIndex + 1} sur {segments.length}</h2>
        </div>
        <span className="mapping-complete-badge"><CheckIcon /> Détecté</span>
      </div>

      <section className="mapping-question-summary" aria-label="Question cartographiée">
        <div className="mapping-question-summary__title">
          <strong>{getSegmentDisplayName(selectedSegment, selectedIndex)}</strong>
          <span>{getQuestionTypeLabel(selectedSegment.question_type_hint)}</span>
        </div>
        <div className="mapping-question-summary__meta">
          <span>Page{selectedSegment.question_pages.length > 1 ? "s" : ""} {selectedSegment.question_pages.join(", ")}</span>
          {selectedSegment.contains_essential_image && <span><ImageIcon /> Illustration</span>}
          <span>Confiance {Math.round(selectedSegment.confidence * 100)} %</span>
        </div>
        <button
          className="button button--danger button--small"
          onClick={() => onDeleteSegment(selectedSegment.temporary_id)}
          type="button"
        >
          <TrashIcon /> Supprimer ce QCM
        </button>
      </section>

      {document.warnings.length > 0 && (
        <details className="mapping-warnings">
          <summary>{document.warnings.length} avertissement{document.warnings.length > 1 ? "s" : ""} sur le document</summary>
          <ul>{document.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </details>
      )}

      {selectedSegment.warnings.length > 0 && (
        <section className="mapping-warnings" aria-label="Avertissements de la question">
          <strong><WarningIcon /> Points à vérifier</strong>
          <ul>{selectedSegment.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </section>
      )}

      <section className="region-editor" aria-label="Éditeur géométrique des zones">
        <div className="region-editor__heading">
          <div>
            <span className="eyebrow">Éditeur de zones</span>
            <strong>Page {currentPage}</strong>
          </div>
          <span>{regionsOnCurrentPage.length} zone{regionsOnCurrentPage.length > 1 ? "s" : ""}</span>
        </div>

        <p className="region-editor__help">
          Une zone « Énoncé » regroupe tout le texte du QCM : consigne, propositions, réponse correcte et feedback.
          Plusieurs zones « Énoncé » peuvent appartenir à la même question, y compris sur plusieurs pages.
          Faites glisser une zone pour la déplacer et utilisez ses poignées pour la redimensionner.
        </p>

        <div className="region-editor__add-row">
          <label>
            <span>Nouvelle zone</span>
            <select
              disabled={isDrawing}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onDrawingRoleChange(event.target.value as PageRegionRole)}
              value={drawingRole}
            >
              {PAGE_REGION_ROLES.map((role) => (
                <option key={role} value={role}>{getPageRegionRoleLabel(role)}</option>
              ))}
            </select>
          </label>
          <button
            className={`button ${isDrawing ? "button--secondary" : "button--primary"} region-editor__draw-button`}
            onClick={onToggleDrawing}
            type="button"
          >
            {isDrawing ? <StopIcon /> : <PlusIcon />}
            {isDrawing ? "Annuler" : "Tracer"}
          </button>
        </div>

        {isDrawing && (
          <div className="region-editor__drawing-notice" role="status">
            <SelectionIcon /> Tracez la nouvelle zone directement sur le PDF.
          </div>
        )}

        <div className="region-editor__list" aria-label="Zones de la question sur la page courante">
          {regionsOnCurrentPage.length === 0 && (
            <span className="region-editor__empty">Aucune zone de cette question sur la page.</span>
          )}
          {regionsOnCurrentPage.map((region, index) => (
            <button
              key={region.client_id}
              aria-pressed={region.client_id === mapping.selectedRegionId}
              className={`region-chip${region.client_id === mapping.selectedRegionId ? " region-chip--selected" : ""}`}
              onClick={() => onSelectRegion(selectedSegment.temporary_id, region.client_id)}
              type="button"
            >
              <span>{index + 1}</span>
              {getPageRegionRoleLabel(region.role)}
              {region.origin === "user" && <small>modifiée</small>}
            </button>
          ))}
        </div>

        {selectedRegion !== null && selectedRegion.page === currentPage && (
          <div className="region-editor__selection">
            <label>
              <span>Rôle de la zone sélectionnée</span>
              <select
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onUpdateRegionRole(
                  selectedSegment.temporary_id,
                  selectedRegion.client_id,
                  event.target.value as PageRegionRole
                )}
                value={selectedRegion.role}
              >
                {PAGE_REGION_ROLES.map((role) => (
                  <option key={role} value={role}>{getPageRegionRoleLabel(role)}</option>
                ))}
              </select>
            </label>
            <button
              aria-label="Supprimer la zone sélectionnée"
              className="button button--danger button--icon"
              onClick={() => onDeleteRegion(selectedSegment.temporary_id, selectedRegion.client_id)}
              title="Supprimer la zone"
              type="button"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </section>

      <footer className="mapping-panel__footer mapping-question-navigation">
        <div className="mapping-usage">
          <span>Modèle : {mapping.meta?.model ?? "—"}</span>
          <span>Jetons : {formatTokens(mapping.meta?.usage.total_tokens ?? null)}</span>
        </div>
        <div className="mapping-question-navigation__buttons">
          <button
            className="button button--secondary"
            disabled={previousSegment === undefined}
            onClick={() => previousSegment !== undefined && onSelectSegment(previousSegment.temporary_id)}
            type="button"
          >
            <ChevronLeftIcon /> Précédente
          </button>
          {!isLast ? (
            <button
              className="button button--primary"
              disabled={nextSegment === undefined}
              onClick={() => nextSegment !== undefined && onSelectSegment(nextSegment.temporary_id)}
              type="button"
            >
              Suivante <ChevronRightIcon />
            </button>
          ) : (
            <button className="button button--primary" onClick={onValidate} type="button">
              <CheckIcon /> Valider les zones et continuer
            </button>
          )}
        </div>
        <button className="mapping-reanalyze-button" onClick={onAnalyze} type="button">
          <SparklesIcon /> Relancer l’analyse
        </button>
      </footer>
    </aside>
  );
}
