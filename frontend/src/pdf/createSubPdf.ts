import { PDFDocument } from "pdf-lib";
import type { GeneratedBatchArtifact, PlannedBatch } from "../domain/batchPlan";
import { createBatchFilename } from "../domain/batchPlan";

export class SubPdfGenerationError extends Error {
  public constructor(message: string, public readonly batchId: string) {
    super(message);
    this.name = "SubPdfGenerationError";
  }
}

export async function createSubPdf(
  sourceBytes: ArrayBuffer,
  sourceFilename: string,
  batch: PlannedBatch
): Promise<GeneratedBatchArtifact> {
  if (batch.originalPages.length === 0) {
    throw new SubPdfGenerationError("Le lot ne contient aucune page à copier.", batch.id);
  }

  try {
    const sourceDocument = await PDFDocument.load(new Uint8Array(sourceBytes.slice(0)), {
      updateMetadata: false
    });
    const targetDocument = await PDFDocument.create();
    const copiedPages = await targetDocument.copyPages(
      sourceDocument,
      batch.originalPages.map((page) => page - 1)
    );

    copiedPages.forEach((page) => targetDocument.addPage(page));
    targetDocument.setTitle(`${sourceFilename} — ${batch.id}`);
    targetDocument.setSubject("Sous-PDF généré localement pour l’extraction de QCM");
    targetDocument.setCreator("Extracteur de QCM");
    targetDocument.setProducer("pdf-lib");

    const bytes = await targetDocument.save({
      addDefaultPage: false,
      objectsPerTick: 50,
      useObjectStreams: true,
      updateFieldAppearances: false
    });

    return {
      batchId: batch.id,
      fileName: createBatchFilename(sourceFilename, batch),
      bytes,
      actualBytes: bytes.byteLength,
      generatedAt: Date.now()
    };
  } catch (error: unknown) {
    throw new SubPdfGenerationError(
      error instanceof Error
        ? `Impossible de créer le sous-PDF : ${error.message}`
        : "Impossible de créer le sous-PDF.",
      batch.id
    );
  }
}
