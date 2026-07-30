import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PdfPageCanvas } from "./PdfPageCanvas";

interface PdfThumbnailProps {
  readonly document: PDFDocumentProxy;
  readonly pageNumber: number;
  readonly selected: boolean;
  readonly onSelect: (pageNumber: number) => void;
}

export function PdfThumbnail({
  document,
  pageNumber,
  selected,
  onSelect
}: PdfThumbnailProps): React.ReactElement {
  const itemRef = useRef<HTMLButtonElement>(null);
  const [isVisible, setIsVisible] = useState(pageNumber <= 4);

  useEffect(() => {
    const element = itemRef.current;
    if (element === null || isVisible) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (selected) {
      itemRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  return (
    <button
      ref={itemRef}
      aria-current={selected ? "page" : undefined}
      aria-label={`Afficher la page ${pageNumber}`}
      className={`thumbnail${selected ? " thumbnail--selected" : ""}`}
      onClick={() => onSelect(pageNumber)}
      type="button"
    >
      <span className="thumbnail__page">
        {isVisible ? (
          <PdfPageCanvas
            className="pdf-canvas-frame--thumbnail"
            document={document}
            pageNumber={pageNumber}
            scale={0.19}
          />
        ) : (
          <span className="thumbnail__placeholder" />
        )}
      </span>
      <span className="thumbnail__number">{pageNumber}</span>
    </button>
  );
}
