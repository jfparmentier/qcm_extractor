import { useEffect, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
  ResetIcon,
  SparklesIcon
} from "./Icons";

interface PdfToolbarProps {
  readonly currentPage: number;
  readonly pageCount: number;
  readonly zoom: number;
  readonly onPageChange: (page: number) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onResetZoom: () => void;
  readonly onAnalyze?: () => void;
}

export function PdfToolbar({
  currentPage,
  pageCount,
  zoom,
  onPageChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onAnalyze
}: PdfToolbarProps): React.ReactElement {
  const [pageInput, setPageInput] = useState(String(currentPage));

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const commitPage = (): void => {
    const value = Number.parseInt(pageInput, 10);
    if (Number.isFinite(value)) {
      onPageChange(value);
    } else {
      setPageInput(String(currentPage));
    }
  };

  return (
    <div className="pdf-toolbar" role="toolbar" aria-label="Commandes du document PDF">
      <div className="toolbar-group">
        <button
          aria-label="Page précédente"
          className="icon-button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Page précédente (←)"
          type="button"
        >
          <ChevronLeftIcon />
        </button>

        <label className="page-control">
          <span className="visually-hidden">Numéro de page</span>
          <input
            aria-label="Numéro de page"
            inputMode="numeric"
            max={pageCount}
            min={1}
            onBlur={commitPage}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPageInput(event.currentTarget.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") {
                commitPage();
                event.currentTarget.blur();
              }
            }}
            value={pageInput}
          />
          <span>sur {pageCount}</span>
        </label>

        <button
          aria-label="Page suivante"
          className="icon-button"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          title="Page suivante (→)"
          type="button"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="toolbar-divider" aria-hidden="true" />

      <div className="toolbar-group">
        <button
          aria-label="Réduire le zoom"
          className="icon-button"
          onClick={onZoomOut}
          title="Réduire le zoom (-)"
          type="button"
        >
          <MinusIcon />
        </button>
        <output className="zoom-value" aria-label="Niveau de zoom">
          {Math.round(zoom * 100)} %
        </output>
        <button
          aria-label="Augmenter le zoom"
          className="icon-button"
          onClick={onZoomIn}
          title="Augmenter le zoom (+)"
          type="button"
        >
          <PlusIcon />
        </button>
        <button
          aria-label="Réinitialiser le zoom"
          className="icon-button"
          onClick={onResetZoom}
          title="Réinitialiser le zoom (0)"
          type="button"
        >
          <ResetIcon />
        </button>
      </div>

      {onAnalyze !== undefined && (
        <button
          className="button button--primary pdf-toolbar__primary-action"
          onClick={onAnalyze}
          type="button"
        >
          <SparklesIcon /> Cartographier
        </button>
      )}
    </div>
  );
}
