import Ajv2020 from "ajv/dist/2020";
import mappingSchema from "../schemas/mappingSchema.js?v=7.4.0";
export const PAGE_REGION_ROLES = [
    "question",
    "essential_image"
];
export class DocumentMapValidationError extends Error {
    issues;
    constructor(message, issues) {
        super(message);
        this.issues = issues;
        this.name = "DocumentMapValidationError";
    }
}
const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false
});
const validateSchema = ajv.compile(mappingSchema);
function formatAjvErrors(errors) {
    if (errors === null || errors === undefined) {
        return [];
    }
    return errors.map((error) => {
        const location = error.instancePath.length > 0 ? error.instancePath : "/";
        return `${location} : ${error.message ?? "valeur invalide"}`;
    });
}
function uniqueSortedPages(pages) {
    return [...new Set(pages)].sort((left, right) => left - right);
}
function assertPagesExist(pages, pageCount, label, segmentId) {
    const invalid = pages.filter((page) => page < 1 || page > pageCount);
    if (invalid.length > 0) {
        throw new DocumentMapValidationError("La cartographie référence des pages inexistantes.", [`${segmentId}.${label} : ${invalid.join(", ")}`]);
    }
}
export function clampNormalizedBoundingBox(bbox, minimumSize = 0.01) {
    const width = Math.min(1, Math.max(minimumSize, bbox.width));
    const height = Math.min(1, Math.max(minimumSize, bbox.height));
    const x = Math.min(1 - width, Math.max(0, bbox.x));
    const y = Math.min(1 - height, Math.max(0, bbox.y));
    return { x, y, width, height };
}
function normalizeBbox(bbox, segmentId, diagnostics) {
    const right = bbox.x + bbox.width;
    const bottom = bbox.y + bbox.height;
    if (right <= 1 && bottom <= 1) {
        return bbox;
    }
    const width = Math.min(bbox.width, Math.max(0, 1 - bbox.x));
    const height = Math.min(bbox.height, Math.max(0, 1 - bbox.y));
    if (width <= 0 || height <= 0) {
        throw new DocumentMapValidationError("Une région de la cartographie se situe hors de la page.", [`${segmentId} : bbox impossible à normaliser`]);
    }
    diagnostics.push(`${segmentId} : une région dépassait la page et a été ramenée à ses limites.`);
    return { x: bbox.x, y: bbox.y, width, height };
}
function overlapRatio(first, second) {
    const left = Math.max(first.x, second.x);
    const top = Math.max(first.y, second.y);
    const right = Math.min(first.x + first.width, second.x + second.width);
    const bottom = Math.min(first.y + first.height, second.y + second.height);
    const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
    if (intersection === 0) {
        return 0;
    }
    const firstArea = first.width * first.height;
    const secondArea = second.width * second.height;
    return intersection / Math.min(firstArea, secondArea);
}
function detectStrongOverlaps(segments) {
    const warnings = [];
    for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
        const first = segments[firstIndex];
        if (first === undefined) {
            continue;
        }
        for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
            const second = segments[secondIndex];
            if (second === undefined) {
                continue;
            }
            const firstRegions = first.page_regions.filter((region) => region.role === "question");
            const secondRegions = second.page_regions.filter((region) => region.role === "question");
            const stronglyOverlapping = firstRegions.some((firstRegion) => secondRegions.some((secondRegion) => firstRegion.page === secondRegion.page &&
                overlapRatio(firstRegion.bbox, secondRegion.bbox) >= 0.8));
            if (stronglyOverlapping) {
                warnings.push(`${first.temporary_id} et ${second.temporary_id} se superposent fortement ; vérifiez qu’il ne s’agit pas d’un doublon.`);
            }
        }
    }
    return warnings;
}
export function createUserRegionId(segmentId) {
    const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${segmentId}-user-${randomPart}`;
}
export function validateAndNormalizeDocumentMap(value, actualPageCount) {
    if (!validateSchema(value)) {
        throw new DocumentMapValidationError("La réponse du LLM ne respecte pas le schéma de cartographie.", formatAjvErrors(validateSchema.errors));
    }
    const diagnostics = [];
    const ids = new Set();
    const segments = value.question_segments.map((segment) => {
        if (ids.has(segment.temporary_id)) {
            throw new DocumentMapValidationError("La cartographie contient des identifiants dupliqués.", [segment.temporary_id]);
        }
        ids.add(segment.temporary_id);
        const answerPages = uniqueSortedPages(segment.answer_pages);
        const feedbackPages = uniqueSortedPages(segment.feedback_pages);
        const questionPages = uniqueSortedPages([
            ...segment.question_pages,
            ...answerPages,
            ...feedbackPages,
            ...segment.page_regions
                .filter((region) => region.role === "question")
                .map((region) => region.page)
        ]);
        assertPagesExist(questionPages, actualPageCount, "question_pages", segment.temporary_id);
        assertPagesExist(answerPages, actualPageCount, "answer_pages", segment.temporary_id);
        assertPagesExist(feedbackPages, actualPageCount, "feedback_pages", segment.temporary_id);
        const pageRegions = segment.page_regions.map((region, regionIndex) => {
            assertPagesExist([region.page], actualPageCount, "page_regions", segment.temporary_id);
            return {
                client_id: `${segment.temporary_id}-region-${regionIndex + 1}`,
                page: region.page,
                role: region.role,
                bbox: normalizeBbox(region.bbox, segment.temporary_id, diagnostics),
                origin: "llm"
            };
        });
        if (!pageRegions.some((region) => region.role === "question")) {
            diagnostics.push(`${segment.temporary_id} : aucune région « Énoncé » n’a été localisée.`);
        }
        return {
            ...segment,
            question_pages: questionPages,
            answer_pages: answerPages,
            feedback_pages: feedbackPages,
            page_regions: pageRegions,
            warnings: [...new Set(segment.warnings)]
        };
    });
    segments.sort((left, right) => {
        const pageDifference = (left.question_pages[0] ?? 1) - (right.question_pages[0] ?? 1);
        return pageDifference !== 0
            ? pageDifference
            : left.temporary_id.localeCompare(right.temporary_id, "fr");
    });
    if (value.document.page_count !== actualPageCount) {
        diagnostics.push(`Le LLM a indiqué ${value.document.page_count} pages, tandis que le lecteur PDF en compte ${actualPageCount}. La valeur locale a été retenue.`);
    }
    diagnostics.push(...detectStrongOverlaps(segments));
    return {
        documentMap: {
            ...value,
            document: {
                ...value.document,
                page_count: actualPageCount,
                warnings: [...new Set([...value.document.warnings, ...diagnostics])]
            },
            question_segments: segments
        },
        diagnostics
    };
}
export function getSegmentDisplayName(segment, index) {
    if (segment.question_number !== null && segment.question_number.trim().length > 0) {
        return `Question ${segment.question_number.trim()}`;
    }
    return `Question détectée ${index + 1}`;
}
export function getQuestionTypeLabel(type) {
    switch (type) {
        case "single_choice":
            return "Réponse unique";
        case "multiple_choice":
            return "Réponses multiples";
        case "true_false":
            return "Vrai / faux";
        case "unknown":
            return "Type à vérifier";
    }
}
export function getDocumentTypeLabel(type) {
    switch (type) {
        case "slides":
            return "Diaporama";
        case "dense_question_bank":
            return "Banque dense";
        case "scanned_document":
            return "Document numérisé";
        case "mixed":
            return "Document mixte";
        case "unknown":
            return "Type indéterminé";
    }
}
export function getPageRegionRoleLabel(role) {
    switch (role) {
        case "question":
            return "Énoncé";
        case "essential_image":
            return "Illustration essentielle";
    }
}
