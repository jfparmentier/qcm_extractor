export function LoadingPanel(): React.ReactElement {
  return (
    <section className="loading-panel" aria-live="polite" aria-busy="true">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <h1>Chargement du document</h1>
        <p>Lecture de la structure PDF et préparation des pages…</p>
      </div>
    </section>
  );
}
