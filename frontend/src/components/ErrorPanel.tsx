import type { ProjectError } from "../domain/projectState";
import { WarningIcon } from "./Icons";

interface ErrorPanelProps {
  readonly error: ProjectError;
  readonly onRetry: () => void;
}

export function ErrorPanel({ error, onRetry }: ErrorPanelProps): React.ReactElement {
  return (
    <section className="error-panel" role="alert">
      <span className="error-panel__icon"><WarningIcon /></span>
      <div>
        <span className="eyebrow">Erreur de chargement</span>
        <h1>{error.message}</h1>
        {error.technicalDetails !== undefined && (
          <details>
            <summary>Détails techniques</summary>
            <code>{error.technicalDetails}</code>
          </details>
        )}
        <button className="button button--primary" onClick={onRetry} type="button">
          Sélectionner un autre fichier
        </button>
      </div>
    </section>
  );
}
