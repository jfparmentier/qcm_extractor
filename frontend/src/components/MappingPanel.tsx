import { useEffect, useMemo, useState } from "react";
import type { MappingState } from "../domain/projectState";
import {
  PAGE_REGION_ROLES,
  getPageRegionRoleLabel,
  getSegmentDisplayName,
  type PageRegionRole
} from "../domain/documentMap";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
  onToggleDrawing
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
  const progressPercentage = Math.round(((selectedIndex + 1) / segments.length) * 100);
  return (
    <aside className="mapping-panel" aria-label="Validation de la cartographie question par question">
      <header className="mapping-review-header">
        <div className="mapping-review-header__topline">
          <div>
            <span className="eyebrow">Vérification des zones</span>
            <h2>Question {selectedIndex + 1} <span>sur {segments.length}</span></h2>
          </div>
          <span className="mapping-position-badge" aria-label={`${progressPercentage} % du parcours`}>
            {progressPercentage} %
          </span>
        </div>

        <div
          aria-label={`Progression : question ${selectedIndex + 1} sur ${segments.length}`}
          aria-valuemax={segments.length}
          aria-valuemin={1}
          aria-valuenow={selectedIndex + 1}
          className="mapping-review-progress"
          role="progressbar"
        >
          <span style={{ width: `${progressPercentage}%` }} />
        </div>

        <label className="mapping-question-picker">
          <span>Aller à une question</span>
          <select
            aria-label="Choisir la question à vérifier"
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onSelectSegment(event.target.value)}
            value={selectedSegment.temporary_id}
          >
            {segments.map((segment, index) => (
              <option key={segment.temporary_id} value={segment.temporary_id}>
                {index + 1}. {getSegmentDisplayName(segment, index)} — page{segment.question_pages.length > 1 ? "s" : ""} {segment.question_pages.join(", ")}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="mapping-review-body">
        <div className="mapping-task-cue" role="note">
          <SelectionIcon />
          <div>
            <strong>À vérifier maintenant</strong>
            <span>Les cadres du PDF doivent contenir toute la question, sans contenu voisin.</span>
          </div>
        </div>

        {document.warnings.length > 0 && (
        <details className="mapping-warnings">
          <summary>{document.warnings.length} avertissement{document.warnings.length > 1 ? "s" : ""} sur le document</summary>
          <ul>{document.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </details>
        )}

        <section className="region-editor" aria-label="Éditeur géométrique des zones">
        <div className="region-editor__heading">
          <div>
            <span className="eyebrow">Zones visibles sur le PDF</span>
            <strong>Page {currentPage}</strong>
          </div>
          <span>{regionsOnCurrentPage.length} zone{regionsOnCurrentPage.length > 1 ? "s" : ""}</span>
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

        <div className="region-editor__add-row">
          <label>
            <span>Type de la nouvelle zone</span>
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
            aria-label={isDrawing ? "Annuler le tracé" : "Tracer une nouvelle zone"}
            className={`button ${isDrawing ? "button--secondary" : "button--primary"} button--icon region-editor__draw-button`}
            onClick={onToggleDrawing}
            title={isDrawing ? "Annuler le tracé" : "Tracer une nouvelle zone"}
            type="button"
          >
            {isDrawing ? <StopIcon /> : <PlusIcon />}
          </button>
        </div>
        <button
          className="mapping-delete-question"
          onClick={() => onDeleteSegment(selectedSegment.temporary_id)}
          type="button"
        >
          <TrashIcon /> Retirer cette question
        </button>
        </section>
      </div>

      <footer className="mapping-panel__footer mapping-question-navigation">
        <span className="mapping-navigation-status" aria-live="polite">
          {isLast ? "Dernière question : validez pour continuer" : `${segments.length - selectedIndex - 1} question${segments.length - selectedIndex - 1 > 1 ? "s" : ""} après celle-ci`}
        </span>
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
              <CheckIcon /> Valider les zones
            </button>
          )}
        </div>
      </footer>
    </aside>
  );
}
