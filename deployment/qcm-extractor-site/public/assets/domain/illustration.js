export const INITIAL_ILLUSTRATION_GENERATION_STATE = {
    status: "idle",
    assets: {},
    errors: {},
    progress: null,
    startedAt: null
};
function imageRoleFromRegion(role) {
    if (role === "essential_image")
        return "essential";
    if (role === "decorative_image")
        return "decorative";
    return null;
}
function safeFilePart(value) {
    const normalized = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return normalized.length > 0 ? normalized : "illustration";
}
function bboxDistance(first, second) {
    const firstCenterX = first.x + first.width / 2;
    const firstCenterY = first.y + first.height / 2;
    const secondCenterX = second.x + second.width / 2;
    const secondCenterY = second.y + second.height / 2;
    return Math.hypot(firstCenterX - secondCenterX, firstCenterY - secondCenterY) +
        Math.abs(first.width - second.width) +
        Math.abs(first.height - second.height);
}
function selectMetadata(images, usedIndexes, sourcePage, role, bbox) {
    const available = images
        .map((image, index) => ({ image, index }))
        .filter(({ index }) => !usedIndexes.has(index));
    if (available.length === 0)
        return null;
    const ranked = available
        .map((entry) => {
        const rolePenalty = entry.image.role === role ? 0 : 100;
        const pagePenalty = entry.image.source_page === sourcePage ? 0 : 10;
        return {
            ...entry,
            score: rolePenalty + pagePenalty + bboxDistance(entry.image.bbox, bbox)
        };
    })
        .sort((left, right) => left.score - right.score);
    const best = ranked[0];
    if (best === undefined || best.score >= 100)
        return null;
    return { image: best.image, index: best.index };
}
function uniqueId(preferred, used) {
    let candidate = safeFilePart(preferred);
    let serial = 2;
    while (used.has(candidate)) {
        candidate = `${safeFilePart(preferred)}-${serial}`;
        serial += 1;
    }
    used.add(candidate);
    return candidate;
}
function candidateFingerprint(candidate) {
    const bbox = candidate.bbox;
    return [
        candidate.id,
        candidate.regionId,
        candidate.questionId ?? "",
        candidate.sourcePage,
        bbox.x.toFixed(6),
        bbox.y.toFixed(6),
        bbox.width.toFixed(6),
        bbox.height.toFixed(6),
        candidate.role,
        candidate.insertionToken
    ].join(":");
}
export function createIllustrationPlan(documentMap, questions) {
    const questionsBySegment = new Map();
    questions.forEach((question) => {
        const existing = questionsBySegment.get(question.segment_id) ?? [];
        questionsBySegment.set(question.segment_id, [...existing, question]);
    });
    const candidates = [];
    const warnings = [];
    const usedAssetIds = new Set();
    let segmentsWithImages = 0;
    documentMap.question_segments.forEach((segment, segmentIndex) => {
        const imageRegions = segment.page_regions
            .filter((region) => imageRoleFromRegion(region.role) !== null)
            .sort((left, right) => left.page - right.page ||
            left.bbox.y - right.bbox.y ||
            left.bbox.x - right.bbox.x);
        if (imageRegions.length === 0)
            return;
        segmentsWithImages += 1;
        const segmentQuestions = questionsBySegment.get(segment.temporary_id) ?? [];
        const question = segmentQuestions[0] ?? null;
        if (segmentQuestions.length > 1) {
            warnings.push(`${segment.temporary_id} possède plusieurs questions extraites ; la première est utilisée pour associer les illustrations.`);
        }
        if (question === null) {
            warnings.push(`${segment.temporary_id} contient ${imageRegions.length} zone(s) d’image, mais aucune question extraite n’est disponible.`);
        }
        const usedMetadataIndexes = new Set();
        imageRegions.forEach((region, regionIndex) => {
            const role = imageRoleFromRegion(region.role);
            if (role === null)
                return;
            const matched = question === null
                ? null
                : selectMetadata(question.images, usedMetadataIndexes, region.page, role, region.bbox);
            if (matched !== null)
                usedMetadataIndexes.add(matched.index);
            const serial = (regionIndex + 1).toString().padStart(2, "0");
            const preferredAssetId = matched?.image.id ?? `${question?.id ?? segment.temporary_id}-asset-${serial}`;
            const id = uniqueId(preferredAssetId, usedAssetIds);
            const insertionToken = matched?.image.insertion_token ?? `asset:${id}`;
            const questionLabel = question?.title.content.trim() ||
                question?.statement.trim().slice(0, 80) ||
                segment.question_number?.trim() ||
                `Question ${segmentIndex + 1}`;
            const candidateWarnings = [];
            if (matched === null && question !== null) {
                candidateWarnings.push("Aucune métadonnée d’image issue de l’extraction n’a pu être associée à cette zone.");
            }
            const statementContainsToken = question?.statement.includes(insertionToken) ?? false;
            if (question !== null && !statementContainsToken) {
                candidateWarnings.push("Le jeton de cette illustration n’est pas encore présent dans l’énoncé extrait.");
            }
            candidates.push({
                id,
                segmentId: segment.temporary_id,
                regionId: region.client_id,
                questionId: question?.id ?? null,
                questionLabel,
                role,
                sourcePage: region.page,
                bbox: region.bbox,
                regionOrigin: region.origin,
                altText: matched?.image.alt_text.trim() || `Illustration associée à ${questionLabel}`,
                insertionToken,
                statementContainsToken,
                fileName: `${safeFilePart(question?.id ?? segment.temporary_id)}-${serial}.png`,
                warnings: candidateWarnings
            });
        });
        if (question !== null && usedMetadataIndexes.size < question.images.length) {
            warnings.push(`${segment.temporary_id} : ${question.images.length - usedMetadataIndexes.size} image(s) décrite(s) par le LLM ne correspondent à aucune zone d’image de la cartographie.`);
        }
    });
    const fingerprint = candidates.map(candidateFingerprint).join("|");
    return {
        candidates,
        segmentCount: segmentsWithImages,
        questionCount: new Set(candidates.map((candidate) => candidate.questionId).filter(Boolean)).size,
        warnings: [...new Set(warnings)],
        fingerprint
    };
}
export function illustrationRoleLabel(role) {
    return role === "essential" ? "Illustration essentielle" : "Illustration décorative";
}
export function revokeIllustrationAssets(assets) {
    Object.values(assets).forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
}
