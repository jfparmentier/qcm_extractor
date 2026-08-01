function exportChoiceId(id) {
    const clean = id.replace(/^choice-/, "").replace(/[^A-Za-z0-9._-]+/g, "-") || "option";
    return `choice-${clean}`;
}
function normalizeChoiceIds(question) {
    const idMap = new Map();
    const used = new Set();
    const choices = question.choices.map((choice, index) => {
        const base = exportChoiceId(choice.id || String.fromCharCode(97 + index));
        let id = base;
        let serial = 2;
        while (used.has(id)) {
            id = `${base}-${serial}`;
            serial += 1;
        }
        used.add(id);
        idMap.set(choice.id, id);
        return { id, content: choice.content };
    });
    return {
        choices,
        correctChoiceIds: question.correct_choice_ids
            .map((id) => idMap.get(id))
            .filter((id) => id !== undefined)
    };
}
export function createReviewQuestions(questions) {
    return questions.map((question) => {
        const normalizedChoices = normalizeChoiceIds(question);
        return {
            id: question.id,
            segmentId: question.segment_id,
            type: question.type,
            title: question.title.content,
            titleOrigin: question.title.origin,
            statement: question.statement,
            choices: normalizedChoices.choices,
            correctChoiceIds: normalizedChoices.correctChoiceIds,
            correctAnswerOrigin: question.correct_answer_origin,
            feedback: question.feedback.content,
            feedbackOrigin: question.feedback.origin,
            sourcePages: question.source_pages,
            confidence: question.confidence,
            warnings: question.warnings,
            validated: false
        };
    });
}
export function reviewSourceFingerprint(questions) {
    return questions.map((question) => [
        question.id,
        question.segment_id,
        question.type,
        question.title.content,
        question.statement,
        question.choices.map((choice) => `${choice.id}:${choice.content}`).join("|"),
        question.correct_choice_ids.join(","),
        question.feedback.content,
        question.source_pages.join(",")
    ].join("::")).join("\n");
}
export function reviewQuestionIssues(question) {
    const issues = [];
    if (question.statement.trim().length === 0)
        issues.push("L’énoncé est vide.");
    if (question.choices.length < 2)
        issues.push("Au moins deux propositions sont nécessaires.");
    if (question.type === "true_false" && question.choices.length !== 2) {
        issues.push("Une question vrai ou faux doit contenir exactement deux propositions.");
    }
    if (question.choices.some((choice) => choice.content.trim().length === 0)) {
        issues.push("Toutes les propositions doivent contenir un texte.");
    }
    const choiceIds = new Set(question.choices.map((choice) => choice.id));
    if (choiceIds.size !== question.choices.length)
        issues.push("Les identifiants de propositions ne sont pas uniques.");
    if (question.correctChoiceIds.some((id) => !choiceIds.has(id))) {
        issues.push("Une réponse correcte référence une proposition inexistante.");
    }
    if (isSingleReviewQuestion(question) && question.correctChoiceIds.length > 1) {
        issues.push("Ce type de question ne peut avoir qu’une seule réponse correcte.");
    }
    if (question.correctAnswerOrigin === "not_available" && question.correctChoiceIds.length > 0) {
        issues.push("Une réponse correcte est sélectionnée alors que son origine est indiquée comme indisponible.");
    }
    if (question.correctAnswerOrigin !== "not_available" && question.correctChoiceIds.length === 0) {
        issues.push("Sélectionnez une réponse correcte ou indiquez qu’elle n’est pas disponible.");
    }
    if (question.sourcePages.length === 0)
        issues.push("Aucune page source n’est associée à la question.");
    return issues;
}
function isSingleReviewQuestion(question) {
    return question.type === "single_choice" || question.type === "true_false";
}
export function nextChoiceId(choices) {
    const used = new Set(choices.map((choice) => choice.id));
    for (let index = 0; index < 26; index += 1) {
        const candidate = `choice-${String.fromCharCode(97 + index)}`;
        if (!used.has(candidate))
            return candidate;
    }
    let serial = choices.length + 1;
    while (used.has(`choice-${serial}`))
        serial += 1;
    return `choice-${serial}`;
}
function candidatesForQuestion(plan, question) {
    return plan.candidates.filter((candidate) => candidate.questionId === question.id ||
        (candidate.questionId === null && candidate.segmentId === question.segmentId));
}
function replaceAssetTokens(statement, candidates) {
    let result = statement;
    const append = [];
    candidates.forEach((candidate) => {
        const markdown = `![${candidate.altText}](assets/${candidate.fileName})`;
        if (result.includes(candidate.insertionToken)) {
            result = result.split(candidate.insertionToken).join(markdown);
        }
        else if (candidate.role === "essential") {
            append.push(markdown);
        }
    });
    if (append.length > 0) {
        result = `${result.trim()}\n\n${append.join("\n\n")}`;
    }
    return result;
}
async function sha256Hex(bytes) {
    if (globalThis.crypto?.subtle === undefined)
        return null;
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes.slice(0));
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
export async function createReviewExport(pdf, documentMap, questions, illustrationPlan, generatedAssets) {
    const sourceSha256 = await sha256Hex(pdf.bytes);
    return {
        schema_version: "1.0.0",
        content_format: "markdown-latex",
        document: {
            title: documentMap.document.title || pdf.title || pdf.fileName.replace(/\.pdf$/i, ""),
            language: documentMap.document.language || "fr",
            source_filename: pdf.fileName,
            source_sha256: sourceSha256
        },
        questions: questions.map((question) => {
            const candidates = candidatesForQuestion(illustrationPlan, question);
            return {
                id: question.id,
                type: question.type,
                title: question.title,
                title_origin: question.titleOrigin,
                statement: replaceAssetTokens(question.statement, candidates),
                choices: question.choices,
                correct_choice_ids: question.correctChoiceIds,
                correct_answer_origin: question.correctAnswerOrigin,
                feedback: question.feedback,
                feedback_origin: question.feedbackOrigin,
                assets: candidates.map((candidate) => ({
                    id: candidate.id.startsWith("asset-") ? candidate.id : `asset-${candidate.id}`,
                    role: candidate.role,
                    path: `assets/${candidate.fileName}`,
                    mime_type: generatedAssets[candidate.id]?.mimeType ?? "image/png",
                    alt_text: candidate.altText,
                    source: {
                        page: candidate.sourcePage,
                        bbox: candidate.bbox
                    }
                })),
                source_pages: question.sourcePages,
                validation_status: "validated"
            };
        })
    };
}
export function downloadJson(value, fileName) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function exportFileName(sourceFileName) {
    const base = sourceFileName.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-") || "qcm";
    return `${base}-qcm.json`;
}
