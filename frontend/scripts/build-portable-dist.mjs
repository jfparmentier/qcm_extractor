import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require('typescript');
} catch (error) {
  throw new Error(
    'TypeScript est requis. Exécutez « npm install » avant « npm run build:portable ».',
    { cause: error }
  );
}

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');
const assetsDir = path.join(distDir, 'assets');

const CDN = {
  react: 'https://esm.sh/react@19.2.8?target=es2022',
  reactJsx: 'https://esm.sh/react@19.2.8/jsx-runtime?target=es2022',
  reactDomClient: 'https://esm.sh/react-dom@19.2.8/client?external=react&target=es2022',
  pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.min.mjs',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs'
};

function addJsExtension(specifier) {
  return /\.(?:js|mjs|json|css)$/.test(specifier) ? specifier : `${specifier}.js`;
}

function rewriteModuleSpecifiers(code) {
  let rewritten = code.replace(
    /(from\s+|import\s*\()(["'])(\.{1,2}\/[^"']+?)\2/g,
    (_match, prefix, quote, specifier) =>
      `${prefix}${quote}${addJsExtension(specifier)}${quote}`
  );

  rewritten = rewritten.replace(
    /(^|\n)(\s*import\s+)(["'])(\.{1,2}\/[^"']+?)\3/g,
    (_match, lineStart, prefix, quote, specifier) =>
      `${lineStart}${prefix}${quote}${addJsExtension(specifier)}${quote}`
  );

  return rewritten;
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

async function writeFile(relativePath, content) {
  const outputPath = path.join(assetsDir, relativePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, 'utf8');
}

await fs.rm(distDir, { recursive: true, force: true });
await fs.mkdir(assetsDir, { recursive: true });

const sourceFiles = await walk(srcDir);
for (const sourcePath of sourceFiles) {
  const relative = path.relative(srcDir, sourcePath);
  if (relative.endsWith('.d.ts') || relative.endsWith('.css')) {
    continue;
  }
  if (!/\.tsx?$/.test(relative)) {
    continue;
  }

  const outputRelative = relative.replace(/\.tsx?$/, '.js');

  if (relative === path.join('pdf', 'pdfWorker.ts')) {
    await writeFile(
      outputRelative,
      `import { GlobalWorkerOptions } from "pdfjs-dist";\n\nGlobalWorkerOptions.workerSrc = ${JSON.stringify(CDN.pdfWorker)};\n`
    );
    continue;
  }

  const source = await fs.readFile(sourcePath, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: sourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      removeComments: false,
      sourceMap: false,
      useDefineForClassFields: true
    },
    reportDiagnostics: true
  });

  const diagnostics = result.diagnostics ?? [];
  const errors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    const host = {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => projectRoot,
      getNewLine: () => '\n'
    };
    throw new Error(ts.formatDiagnostics(errors, host));
  }

  let output = rewriteModuleSpecifiers(result.outputText);
  output = output.replace(/^import\s+["']\.\/styles\/app\.css["'];?\s*$/m, '');
  await writeFile(outputRelative, output);
}

await fs.copyFile(path.join(srcDir, 'styles', 'app.css'), path.join(assetsDir, 'app.css'));

const indexHtml = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Chargement et visualisation locale de documents PDF pour préparer l’extraction de QCM." />
    <title>Extracteur de QCM · Phase 1</title>
    <link rel="stylesheet" href="./assets/app.css" />
    <script type="importmap">
      ${JSON.stringify({
        imports: {
          react: CDN.react,
          'react/jsx-runtime': CDN.reactJsx,
          'react-dom/client': CDN.reactDomClient,
          'pdfjs-dist': CDN.pdfjs
        }
      }, null, 2)}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/main.js"></script>
  </body>
</html>
`;
await fs.writeFile(path.join(distDir, 'index.html'), indexHtml, 'utf8');

const deployment = `# Déploiement de la phase 1

Copiez le contenu de ce dossier sur un serveur HTTP(S). L’ouverture directe par une URL \`file://\` n’est pas prise en charge.

Cette construction portable charge React et PDF.js depuis des CDN versionnés. Le serveur doit donc autoriser les connexions HTTPS vers :

- \`https://esm.sh\`
- \`https://cdn.jsdelivr.net\`

Aucune clé API, aucun compte et aucun stockage serveur ne sont utilisés pendant la phase 1. Le PDF sélectionné demeure dans la mémoire du navigateur.
`;
await fs.writeFile(path.join(distDir, 'DEPLOYMENT.md'), deployment, 'utf8');

const buildInfo = {
  build_format: 'portable-es-modules',
  generated_at: new Date().toISOString(),
  application_version: '0.1.0',
  dependencies: {
    react: '19.2.8',
    react_dom: '19.2.8',
    pdfjs_dist: '6.1.200'
  },
  external_runtime_origins: ['https://esm.sh', 'https://cdn.jsdelivr.net']
};
await fs.writeFile(path.join(distDir, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');

console.log(`Distribution créée dans ${distDir}`);
