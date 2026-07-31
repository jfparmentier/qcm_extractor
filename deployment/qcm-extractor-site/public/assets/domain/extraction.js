import Ajv2020 from "ajv/dist/2020";
import extractionSchema from "../schemas/extractionSchema.js";
import { clampNormalizedBoundingBox } from "./documentMap.js";
export class ExtractionValidationError extends Error {
    issues;
    constructor(message, issues) {
        super(message);
        this.issues = issues;
        this.name = "ExtractionValidationError";
    }
}
const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false
});
const validateSchema = ajv.compile(extractionSchema);
function formatAjvErrors(errors) {
    return (errors ?? []).map((error) => {
        const location = error.instancePath.length > 0 ? error.instancePath : "/";
        return `${location} : ${error.message ?? "valeur invalide"}`;
    });
}
function unique(values) {
    return [...new Set(values)];
}
function normalizePage(page, batch, diagnostics, label) {
    if (batch.originalPages.includes(page)) {
        return page;
    }
    const mapped = batch.pageMap.find((entry) => entry.localPage === page)?.originalPage;
    if (mapped !== undefined) {
        diagnostics.push(`${label} : la page locale ${page} a été convertie en page originale ${mapped}.`);
        return mapped;
    }
    throw new ExtractionValidationError("Le résultat d’extraction référence une page étrangère au lot.", [`${label} : page ${page}`]);
}
function normalizeQuestion(question, batch, diagnostics) {
    const choiceIds = new Set();
    for (const choice of question.choices) {
        if (choiceIds.has(choice.id)) {
            throw new ExtractionValidationError("Une question contient des identifiants de propositions dupliqués.", [`${question.segment_id} : ${choice.id}`]);
        }
        choiceIds.add(choice.id);
    }
    let correctChoiceIds = unique(question.correct_choice_ids).filter((id) => choiceIds.has(id));
    const removedCorrectIds = question.correct_choice_ids.filter((id) => !choiceIds.has(id));
    if (removedCorrectIds.length > 0) {
        diagnostics.push(`${question.segment_id} : des réponses correctes inexistantes ont été retirées (${removedCorrectIds.join(", ")}).`);
    }
    let correctAnswerOrigin = question.correct_answer_origin;
    if (correctAnswerOrigin === "not_available") {
        correctChoiceIds = [];
    }
    else if (correctChoiceIds.length === 0) {
        correctAnswerOrigin = "not_available";
        diagnostics.push(`${question.segment_id} : l’origine de la réponse a été ramenée à not_available faute de proposition valide.`);
    }
    if ((question.type === "single_choice" || question.type === "true_false") && correctChoiceIds.length > 1) {
        correctChoiceIds = correctChoiceIds.slice(0, 1);
        diagnostics.push(`${question.segment_id} : une seule réponse correcte a été conservée.`);
    }
    const sourcePages = unique(question.source_pages.map((page) => normalizePage(page, batch, diagnostics, question.segment_id))).sort((left, right) => left - right);
    const images = question.images.map((image, index) => ({
        ...image,
        source_page: normalizePage(image.source_page, batch, diagnostics, `${question.segment_id}.images[${index}]`),
        bbox: clampNormalizedBoundingBox(image.bbox)
    }));
    const warnings = unique([...question.warnings]);
    if (question.type === "true_false" && question.choices.length !== 2) {
        warnings.push("Une question vrai/faux ne contient pas exactement deux propositions.");
    }
    return {
        ...question,
        title: question.title.origin === "not_available"
            ? { content: "", origin: "not_available" }
            : question.title,
        feedback: question.feedback.origin === "not_available"
            ? { content: "", origin: "not_available" }
            : question.feedback,
        correct_choice_ids: correctChoiceIds,
        correct_answer_origin: correctAnswerOrigin,
        source_pages: sourcePages,
        images,
        confidence: Math.min(1, Math.max(0, question.confidence)),
        warnings
    };
}
export function validateAndNormalizeExtractionResult(value, batch) {
    if (!validateSchema(value)) {
        throw new ExtractionValidationError("La réponse du LLM ne respecte pas le schéma d’extraction.", formatAjvErrors(validateSchema.errors));
    }
    const diagnostics = [];
    const result = value;
    if (result.batch_id !== batch.id) {
        diagnostics.push(`Le LLM a renvoyé le lot ${result.batch_id}; l’identifiant attendu ${batch.id} a été retenu.`);
    }
    const expectedIds = new Set(batch.segmentIds);
    const questionIds = new Set();
    const questions = result.questions.map((question) => {
        if (questionIds.has(question.id)) {
            diagnostics.push(`${question.segment_id} : l’identifiant ${question.id} est dupliqué dans le lot.`);
        }
        questionIds.add(question.id);
        if (!expectedIds.has(question.segment_id)) {
            diagnostics.push(`${question.segment_id} : ce segment n’était pas attendu dans ${batch.id}.`);
        }
        return normalizeQuestion(question, batch, diagnostics);
    });
    const seenSegments = new Set(questions.map((question) => question.segment_id));
    const computedMissing = batch.segmentIds.filter((segmentId) => !seenSegments.has(segmentId));
    const reportedMissing = result.missing_segment_ids.filter((segmentId) => expectedIds.has(segmentId));
    const missingSegmentIds = unique([...computedMissing, ...reportedMissing]);
    return {
        result: {
            ...result,
            batch_id: batch.id,
            questions,
            missing_segment_ids: missingSegmentIds,
            warnings: unique([...result.warnings, ...diagnostics])
        },
        diagnostics
    };
}
function alphabeticChoiceId(index) {
    let value = index;
    let label = "";
    do {
        label = String.fromCharCode(97 + (value % 26)) + label;
        value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    return `choice-${label}`;
}
function rewriteQuestionIdentifiers(question, globalIndex) {
    const serial = (globalIndex + 1).toString().padStart(3, "0");
    const choiceMap = new Map();
    const choices = question.choices.map((choice, index) => {
        const newId = alphabeticChoiceId(index);
        choiceMap.set(choice.id, newId);
        return { ...choice, id: newId };
    });
    let statement = question.statement;
    const images = question.images.map((image, index) => {
        const imageSerial = (index + 1).toString().padStart(2, "0");
        const newId = `asset-${serial}-${imageSerial}`;
        const newToken = `asset:${serial}-${imageSerial}`;
        statement = statement.split(image.insertion_token).join(newToken);
        return { ...image, id: newId, insertion_token: newToken };
    });
    return {
        ...question,
        id: `q-${serial}`,
        statement,
        choices,
        correct_choice_ids: question.correct_choice_ids
            .map((id) => choiceMap.get(id))
            .filter((id) => id !== undefined),
        images
    };
}
export function mergeExtractionResults(documentMap, completed) {
    const expectedOrder = new Map(documentMap.question_segments.map((segment, index) => [segment.temporary_id, index]));
    const questionsBySegment = new Map();
    const completedBatchIds = [];
    const warnings = [];
    for (const batch of completed) {
        completedBatchIds.push(batch.batchId);
        warnings.push(...batch.result.warnings.map((warning) => `${batch.batchId} : ${warning}`));
        for (const question of batch.result.questions) {
            const existing = questionsBySegment.get(question.segment_id) ?? [];
            existing.push(question);
            questionsBySegment.set(question.segment_id, existing);
        }
    }
    const duplicateSegmentIds = [...questionsBySegment.entries()]
        .filter(([, questions]) => questions.length > 1)
        .map(([segmentId]) => segmentId);
    const unexpectedSegmentIds = [...questionsBySegment.keys()].filter((segmentId) => !expectedOrder.has(segmentId));
    const missingSegmentIds = documentMap.question_segments
        .map((segment) => segment.temporary_id)
        .filter((segmentId) => !questionsBySegment.has(segmentId));
    const orderedQuestions = [...questionsBySegment.entries()]
        .filter(([segmentId]) => expectedOrder.has(segmentId))
        .sort(([left], [right]) => (expectedOrder.get(left) ?? 0) - (expectedOrder.get(right) ?? 0))
        .map(([, questions]) => questions[0])
        .filter((question) => question !== undefined)
        .map(rewriteQuestionIdentifiers);
    if (duplicateSegmentIds.length > 0) {
        warnings.push(`Des extractions multiples existent pour : ${duplicateSegmentIds.join(", ")}. La première a été retenue.`);
    }
    if (unexpectedSegmentIds.length > 0) {
        warnings.push(`Des segments inattendus ont été ignorés : ${unexpectedSegmentIds.join(", ")}.`);
    }
    if (missingSegmentIds.length > 0) {
        warnings.push(`${missingSegmentIds.length} segment(s) ne disposent pas encore d’une question extraite.`);
    }
    return {
        questions: orderedQuestions,
        missingSegmentIds,
        duplicateSegmentIds,
        unexpectedSegmentIds,
        completedBatchIds: unique(completedBatchIds),
        warnings: unique(warnings)
    };
}
export function getSegmentById(documentMap, segmentId) {
    return documentMap.question_segments.find((segment) => segment.temporary_id === segmentId) ?? null;
}
