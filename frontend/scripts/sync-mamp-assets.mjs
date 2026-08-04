import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const frontendRoot = path.resolve(import.meta.dirname, "..");
const publicRoot = path.resolve(frontendRoot, "../deployment/qcm-extractor-site/public");
const version = "7.5.6";
const modules = [
  { source: "App.tsx", destination: "App.js" },
  { source: "components/FileDropZone.tsx", destination: "components/FileDropZone.js" },
  { source: "components/MappingPanel.tsx", destination: "components/MappingPanel.js" },
  { source: "components/PdfPageCanvas.tsx", destination: "components/PdfPageCanvas.js" },
  { source: "components/PdfToolbar.tsx", destination: "components/PdfToolbar.js" },
  { source: "components/PdfViewer.tsx", destination: "components/PdfViewer.js" },
  { source: "components/QuestionReview.tsx", destination: "components/QuestionReview.js" },
  { source: "domain/documentMap.ts", destination: "domain/documentMap.js" },
  { source: "domain/extractionContext.ts", destination: "domain/extractionContext.js" },
  { source: "domain/manualMapping.ts", destination: "domain/manualMapping.js" },
  { source: "domain/projectState.ts", destination: "domain/projectState.js" },
  { source: "domain/review.ts", destination: "domain/review.js" },
  { source: "pdf/extractIllustrations.ts", destination: "pdf/extractIllustrations.js" }
];

for (const module of modules) {
  const sourcePath = path.join(frontendRoot, "src", module.source);
  const destinationPath = path.join(publicRoot, "assets", module.destination);
  const result = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023
    },
    fileName: sourcePath
  });
  const browserModule = result.outputText
    .replace(
      /(from\s+["'])(\.\.?\/[^"']+)(["'])/g,
      (_match, before, modulePath, after) => `${before}${modulePath}.js?v=${version}${after}`
    )
    .replace(/^import\s+["'][^"']+\.css["'];\s*$/gm, "");
  fs.writeFileSync(destinationPath, browserModule);
}

fs.copyFileSync(
  path.join(frontendRoot, "src/styles/app.css"),
  path.join(publicRoot, "assets/app.css")
);

const filesToVersion = [
  path.join(publicRoot, "index.html"),
  path.join(publicRoot, "build-info.json"),
  path.join(publicRoot, "assets/main.js"),
  path.join(publicRoot, "assets/App.js")
];

for (const filePath of filesToVersion) {
  const current = fs.readFileSync(filePath, "utf8");
  fs.writeFileSync(filePath, current.replace(/7\.5\.\d+/g, version));
}

console.log(`Ressources MAMP synchronisées — version ${version}.`);
