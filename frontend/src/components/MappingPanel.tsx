import { useEffect, useMemo, useState } from "react";
import type { MappingState } from "../domain/projectState";
import {
  PAGE_REGION_ROLES,
  getDocumentTypeLabel,
  getPageRegionRoleLabel,
  getQuestionTypeLabel,
  getSegmentDisplayName,
  type PageRegionRole
} from "../domain/documentMap";
import {
  CheckIcon,
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
  readonly onSelectSegment: (segmentId: string) => void;
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

function getRunningStatusLabel(mapping: MappingState): string {
  switch (mapping.progress?.providerStatus) {
    case "uploading":
      return "Transmission sécurisée du PDF";
    case "queued":
      return "Analyse placée en file d’attente";
    case "in_progress":
      return "Analyse du document par le LLM";
    default:
      return "Initialisation de l’analyse";
  }
}

export function MappingPanel({
  mapping,
  currentPage,
  drawingRole,
  isDrawing,
  onAnalyze,
  onCancel,
  onSelectSegment,
  onSelectRegion,
  onDrawingRoleChange,
  onToggleDrawing,
  onUpdateRegionRole,
  onDeleteRegion
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
          Le proxy démarre une tâche asynchrone, puis le navigateur interroge régulièrement
          son état. Cette méthode évite les coupures des hébergements PHP pendant les analyses longues.
        </p>
        <div className="mapping-progress" aria-hidden="true">
          <span />
        </div>
        <dl className="mapping-facts">
          <div><dt>État</dt><dd>{getRunningStatusLabel(mapping)}</dd></div>
          <div><dt>Temps écoulé</dt><dd>{formatElapsed(mapping.startedAt, now)}</dd></div>
          <div><dt>Contrôles d’état</dt><dd>{mapping.progress?.pollCount ?? 0}</dd></div>
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

      <section className="region-editor" aria-label="Éditeur géométrique des zones">
        <div className="region-editor__heading">
          <div>
            <span className="eyebrow">Éditeur de zones</span>
            <strong>Page {currentPage}</strong>
          </div>
          <span>{regionsOnCurrentPage.length} zone{regionsOnCurrentPage.length > 1 ? "s" : ""}</span>
        </div>

        {selectedSegment === null ? (
          <p>Sélectionnez une question afin de corriger ses zones.</p>
        ) : (
          <>
            <p className="region-editor__help">
              Faites glisser une zone pour la déplacer. Utilisez ses poignées pour la redimensionner.
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
                  onClick={() => onDeleteRegion(
                    selectedSegment.temporary_id,
                    selectedRegion.client_id
                  )}
                  title="Supprimer la zone"
                  type="button"
                >
                  <TrashIcon />
                </button>
              </div>
            )}
          </>
        )}
      </section>

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
