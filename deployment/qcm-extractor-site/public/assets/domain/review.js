import { createZipBlob } from "../export/createZip.js?v=7.5.5";
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
            type: question.type === "true_false" ? "single_choice" : question.type,
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
    if (question.title.trim().length === 0)
        issues.push("Le titre est vide.");
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
    if (question.feedback.trim().length === 0) {
        issues.push("Le feedback pédagogique est vide.");
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
export async function createReviewArchive(value, illustrationPlan, generatedAssets) {
    const entries = [
        {
            name: "questions.json",
            data: JSON.stringify(value, null, 2)
        },
        {
            name: "moodle.xml",
            data: await createMoodleXml(value, generatedAssets)
        }
    ];
    const usedPaths = new Set();
    for (const candidate of illustrationPlan.candidates) {
        const asset = generatedAssets[candidate.id];
        if (asset === undefined) {
            throw new Error(`L’illustration ${candidate.fileName} n’a pas été générée.`);
        }
        const path = `assets/${candidate.fileName}`;
        if (usedPaths.has(path)) {
            throw new Error(`Le chemin d’illustration ${path} apparaît plusieurs fois.`);
        }
        usedPaths.add(path);
        entries.push({ name: path, data: asset.blob });
    }
    return createZipBlob(entries);
}
function escapeXml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}
function cdata(value) {
    return `<![CDATA[${value.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}
function textAsHtml(value) {
    return escapeXml(value).replaceAll("\n", "<br />\n");
}
function moodleQuestionHtml(question) {
    let statement = question.statement;
    const markers = question.assets.map((asset, index) => {
        const marker = `\uE000QCM_IMAGE_${index}\uE001`;
        const markdown = `![${asset.alt_text}](${asset.path})`;
        statement = statement.split(markdown).join(marker);
        return { asset, marker };
    });
    let html = textAsHtml(statement);
    markers.forEach(({ asset, marker }) => {
        const fileName = asset.path.split("/").pop() ?? asset.path;
        const image = `<img src="@@PLUGINFILE@@/${escapeXml(fileName)}" alt="${escapeXml(asset.alt_text)}" />`;
        html = html.split(marker).join(image);
    });
    return `<div>${html}</div>`;
}
function answerFraction(question, choiceId) {
    if (!question.correct_choice_ids.includes(choiceId))
        return "-100";
    const correctCount = question.correct_choice_ids.length;
    if (correctCount === 0) {
        throw new Error(`La question ${question.id} ne possède aucune réponse correcte.`);
    }
    return (100 / correctCount).toFixed(12).replace(/\.?0+$/, "");
}
function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}
export async function createMoodleXml(value, generatedAssets) {
    const assetsByFileName = new Map(Object.values(generatedAssets).map((asset) => [asset.fileName, asset]));
    const questions = [];
    for (const question of value.questions) {
        if (question.correct_choice_ids.length === 0) {
            throw new Error(`La question ${question.id} ne possède aucune réponse correcte.`);
        }
        const files = [];
        for (const exportedAsset of question.assets) {
            const fileName = exportedAsset.path.split("/").pop() ?? exportedAsset.path;
            const generatedAsset = assetsByFileName.get(fileName);
            if (generatedAsset === undefined) {
                throw new Error(`L’illustration ${fileName} n’a pas été générée.`);
            }
            const base64 = bytesToBase64(new Uint8Array(await generatedAsset.blob.arrayBuffer()));
            files.push(`      <file name="${escapeXml(fileName)}" path="/" encoding="base64">${base64}</file>`);
        }
        const answers = question.choices.map((choice) => [
            `    <answer fraction="${answerFraction(question, choice.id)}" format="html">`,
            `      <text>${cdata(textAsHtml(choice.content))}</text>`,
            "      <feedback format=\"html\"><text></text></feedback>",
            "    </answer>"
        ].join("\n"));
        questions.push([
            "  <question type=\"multichoice\">",
            "    <name>",
            `      <text>${escapeXml(question.title)}</text>`,
            "    </name>",
            "    <questiontext format=\"html\">",
            `      <text>${cdata(moodleQuestionHtml(question))}</text>`,
            ...files,
            "    </questiontext>",
            "    <generalfeedback format=\"html\">",
            `      <text>${cdata(textAsHtml(question.feedback))}</text>`,
            "    </generalfeedback>",
            "    <defaultgrade>1</defaultgrade>",
            "    <penalty>0</penalty>",
            "    <hidden>0</hidden>",
            "    <single>false</single>",
            "    <shuffleanswers>false</shuffleanswers>",
            "    <answernumbering>none</answernumbering>",
            ...answers,
            "  </question>"
        ].join("\n"));
    }
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<quiz>",
        ...questions,
        "</quiz>",
        ""
    ].join("\n");
}
export function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function exportFileName(sourceFileName) {
    const base = sourceFileName.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-") || "qcm";
    return `${base}-qcm.zip`;
}
