import { useRef, useState } from "react";
import { MAX_PDF_SIZE_BYTES } from "../pdf/loadPdf";
import { FileIcon, ShieldIcon, UploadIcon } from "./Icons";

interface FileDropZoneProps {
  readonly disabled?: boolean;
  readonly onFileSelected: (file: File) => void;
}

export function FileDropZone({
  disabled = false,
  onFileSelected
}: FileDropZoneProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const selectFirstFile = (files: FileList | null): void => {
    const file = files?.item(0);
    if (file !== null && file !== undefined) {
      onFileSelected(file);
    }
  };

  return (
    <section className="welcome-panel" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <span className="eyebrow">Phase 1 · Socle frontend</span>
        <h1 id="welcome-title">Préparer un PDF pour l’extraction de QCM</h1>
        <p>
          Le document est chargé et affiché exclusivement dans votre navigateur. Aucun
          transfert réseau n’est effectué pendant cette phase.
        </p>
      </div>

      <button
        className={`drop-zone${isDragging ? " drop-zone--active" : ""}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event: React.DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={(event: React.DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDragOver={(event: React.DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          if (event.dataTransfer !== null) {
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event: React.DragEvent<HTMLButtonElement>) => {
          event.preventDefault();
          setIsDragging(false);
          if (!disabled) {
            selectFirstFile(event.dataTransfer.files);
          }
        }}
        type="button"
      >
        <span className="drop-zone__icon"><UploadIcon /></span>
        <span className="drop-zone__title">Déposer un fichier PDF</span>
        <span className="drop-zone__separator">ou</span>
        <span className="button button--primary"><FileIcon /> Sélectionner un fichier</span>
        <span className="drop-zone__hint">
          PDF uniquement · taille maximale {Math.round(MAX_PDF_SIZE_BYTES / 1024 / 1024)} Mo
        </span>
      </button>

      <input
        ref={inputRef}
        accept="application/pdf,.pdf"
        className="visually-hidden"
        disabled={disabled}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          selectFirstFile(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        type="file"
      />

      <div className="privacy-note">
        <ShieldIcon />
        <div>
          <strong>Traitement local</strong>
          <span>Le PDF reste en mémoire et disparaît lorsque l’onglet est fermé.</span>
        </div>
      </div>
    </section>
  );
}
