import { GlobalWorkerOptions } from "pdfjs-dist";
// Le worker est servi par un CDN qui renvoie explicitement un module JavaScript.
// Cette configuration évite les erreurs de type MIME rencontrées lorsque certains
// serveurs locaux publient les fichiers .mjs comme texte brut ou octet-stream.
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs";
GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
