import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentMap } from "../domain/documentMap";
import { getSegmentDisplayName } from "../domain/documentMap";
import type { GeneratedIllustrationAsset, IllustrationPlan } from "../domain/illustration";
import type { LoadedPdf } from "../domain/projectState";
import {
  nextChoiceId,
  reviewQuestionIssues,
  type EditableChoice,
  type ReviewQuestion
} from "../domain/review";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
  ResetIcon,
  TrashIcon,
  WarningIcon
} from "./Icons";
import { PdfPageCanvas, type PdfOverlayRegion } from "./PdfPageCanvas";

interface QuestionReviewProps {
  readonly pdf: LoadedPdf;
  readonly documentMap: DocumentMap;
  readonly questions: readonly ReviewQuestion[];
  readonly currentIndex: number;
  readonly currentPage: number;
  readonly zoom: number;
  readonly illustrationPlan: IllustrationPlan;
  readonly illustrationAssets: Readonly<Record<string, GeneratedIllustrationAsset>>;
  readonly exporting: boolean;
  readonly onCurrentIndexChange: (index: number) => void;
  readonly onCurrentPageChange: (page: number) => void;
  readonly onQuestionChange: (question: ReviewQuestion) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onResetZoom: () => void;
  readonly onExport: () => void;
  readonly onExit: () => void;
}

function isSingleAnswer(type: ReviewQuestion["type"]): boolean {
  return type === "single_choice" || type === "true_false";
}

function setUserEdited(question: ReviewQuestion, patch: Partial<ReviewQuestion>): ReviewQuestion {
  return { ...question, ...patch, validated: false };
}

function originLabel(origin: string): string {
  switch (origin) {
    case "explicit_in_document": return "Présent dans le document";
    case "generated_by_model": return "Généré par le modèle";
    case "inferred_by_model": return "Déduit par le modèle";
    case "provided_by_user": return "Modifié par l’utilisateur";
    default: return "Non disponible";
  }
}

export function QuestionReview({
  pdf,
  documentMap,
  questions,
  currentIndex,
  currentPage,
  zoom,
  illustrationPlan,
  illustrationAssets,
  exporting,
  onCurrentIndexChange,
  onCurrentPageChange,
  onQuestionChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onExport,
  onExit
}: QuestionReviewProps): React.ReactElement {
  const [renderError, setRenderError] = useState<string | null>(null);
  const question = questions[currentIndex];
  const total = questions.length;
  const validatedCount = questions.filter((entry) => entry.validated).length;
  const allValidated = total > 0 && validatedCount === total;
  const validationIssues = question === undefined ? [] : reviewQuestionIssues(question);
  const canValidate = validationIssues.length === 0;
  const isLast = currentIndex === total - 1;

  const segmentInfo = useMemo(() => {
    if (question === undefined) return null;
    const segmentIndex = documentMap.question_segments.findIndex(
      (segment) => segment.temporary_id === question.segmentId
    );
    const segment = segmentIndex >= 0 ? documentMap.question_segments[segmentIndex] : undefined;
    return segment === undefined ? null : { segment, segmentIndex };
  }, [documentMap.question_segments, question]);

  const sourcePages = useMemo(() => {
    if (question === undefined) return [];
    const pages = new Set(question.sourcePages);
    segmentInfo?.segment.page_regions.forEach((region) => pages.add(region.page));
    return [...pages].sort((left, right) => left - right);
  }, [question, segmentInfo]);

  useEffect(() => {
    if (question === undefined || sourcePages.length === 0) return;
    if (!sourcePages.includes(currentPage)) onCurrentPageChange(sourcePages[0] ?? 1);
    setRenderError(null);
  }, [currentPage, onCurrentPageChange, question, sourcePages]);

  const overlays = useMemo<readonly PdfOverlayRegion[]>(() => {
    if (segmentInfo === null) return [];
    return segmentInfo.segment.page_regions
      .filter((region) => region.page === currentPage && region.role !== "ignore")
      .map((region) => ({
        id: region.client_id,
        regionId: region.client_id,
        segmentId: segmentInfo.segment.temporary_id,
        label: getSegmentDisplayName(segmentInfo.segment, segmentInfo.segmentIndex),
        role: region.role,
        bbox: region.bbox,
        selected: false,
        segmentSelected: true
      }));
  }, [currentPage, segmentInfo]);

  const questionAssets = useMemo(() => {
    if (question === undefined) return [];
    return illustrationPlan.candidates
      .filter((candidate) =>
        candidate.questionId === question.id ||
        (candidate.questionId === null && candidate.segmentId === question.segmentId)
      )
      .map((candidate) => ({ candidate, asset: illustrationAssets[candidate.id] }));
  }, [illustrationAssets, illustrationPlan.candidates, question]);

  const changeQuestion = useCallback((patch: Partial<ReviewQuestion>): void => {
    if (question !== undefined) onQuestionChange(setUserEdited(question, patch));
  }, [onQuestionChange, question]);

  const changeChoice = useCallback((choiceId: string, content: string): void => {
    if (question === undefined) return;
    changeQuestion({
      choices: question.choices.map((choice) => choice.id === choiceId ? { ...choice, content } : choice)
    });
  }, [changeQuestion, question]);

  const toggleCorrectChoice = useCallback((choiceId: string): void => {
    if (question === undefined) return;
    const selected = question.correctChoiceIds.includes(choiceId);
    const correctChoiceIds = isSingleAnswer(question.type)
      ? (selected ? [] : [choiceId])
      : (selected
          ? question.correctChoiceIds.filter((id) => id !== choiceId)
          : [...question.correctChoiceIds, choiceId]);
    changeQuestion({ correctChoiceIds, correctAnswerOrigin: "provided_by_user" });
  }, [changeQuestion, question]);

  const addChoice = useCallback((): void => {
    if (question === undefined) return;
    const choice: EditableChoice = { id: nextChoiceId(question.choices), content: "" };
    changeQuestion({ choices: [...question.choices, choice] });
  }, [changeQuestion, question]);

  const deleteChoice = useCallback((choiceId: string): void => {
    if (question === undefined || question.choices.length <= 2) return;
    changeQuestion({
      choices: question.choices.filter((choice) => choice.id !== choiceId),
      correctChoiceIds: question.correctChoiceIds.filter((id) => id !== choiceId),
      correctAnswerOrigin: question.correctChoiceIds.includes(choiceId)
        ? "provided_by_user"
        : question.correctAnswerOrigin
    });
  }, [changeQuestion, question]);

  const moveChoice = useCallback((choiceId: string, direction: -1 | 1): void => {
    if (question === undefined) return;
    const current = question.choices.findIndex((choice) => choice.id === choiceId);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= question.choices.length) return;
    const choices = [...question.choices];
    const [moved] = choices.splice(current, 1);
    if (moved === undefined) return;
    choices.splice(target, 0, moved);
    changeQuestion({ choices });
  }, [changeQuestion, question]);

  if (question === undefined) {
    return (
      <div className="review-empty-state">
        <strong>Aucune question extraite</strong>
        <button className="button button--secondary" onClick={onExit} type="button">Retour aux étapes</button>
      </div>
    );
  }

  return (
    <section className="question-review" aria-label="Révision des questions">
      <header className="question-review__header">
        <div>
          <span className="eyebrow">Phase 7 · Révision</span>
          <h2>Question {currentIndex + 1} sur {total}</h2>
          <p>{validatedCount} question{validatedCount > 1 ? "s" : ""} validée{validatedCount > 1 ? "s" : ""}</p>
        </div>
        <div className="question-review__header-actions">
          <button className="button button--secondary" onClick={onExit} type="button">
            <ResetIcon /> Étapes précédentes
          </button>
          <label className={`review-validation-toggle${question.validated ? " review-validation-toggle--checked" : ""}`}>
            <input
              checked={question.validated}
              disabled={!canValidate && !question.validated}
              onChange={(event) => onQuestionChange({ ...question, validated: event.target.checked })}
              type="checkbox"
            />
            <CheckIcon /> Question validée
          </label>
        </div>
      </header>

      <div className="question-review__progress" aria-hidden="true">
        <span style={{ width: `${((currentIndex + 1) / total) * 100}%` }} />
      </div>

      <div className="question-review__columns">
        <section className="question-source-column" aria-label="Document PDF source">
          <header className="question-column-header">
            <div>
              <span className="eyebrow">Source</span>
              <h3>PDF de la question</h3>
            </div>
            <div className="review-zoom-controls">
              <button aria-label="Réduire" className="icon-button" onClick={onZoomOut} type="button"><MinusIcon /></button>
              <button className="review-zoom-value" onClick={onResetZoom} type="button">{Math.round(zoom * 100)} %</button>
              <button aria-label="Agrandir" className="icon-button" onClick={onZoomIn} type="button"><PlusIcon /></button>
            </div>
          </header>

          <div className="review-page-tabs" aria-label="Pages sources">
            {sourcePages.map((page) => (
              <button
                aria-current={page === currentPage ? "page" : undefined}
                className={page === currentPage ? "review-page-tab review-page-tab--active" : "review-page-tab"}
                key={page}
                onClick={() => onCurrentPageChange(page)}
                type="button"
              >
                Page {page}
              </button>
            ))}
          </div>

          {renderError !== null && <div className="inline-error" role="alert">{renderError}</div>}
          <div className="question-source-stage">
            <PdfPageCanvas
              className="question-source-canvas"
              document={pdf.document}
              onRenderError={setRenderError}
              overlays={overlays}
              pageNumber={currentPage}
              scale={zoom}
            />
          </div>
        </section>

        <section className="question-editor-column" aria-label="Contenu éditable de la question">
          <header className="question-column-header">
            <div>
              <span className="eyebrow">Contenu extrait</span>
              <h3>{question.id}</h3>
            </div>
            <span className="review-confidence">Confiance {Math.round(question.confidence * 100)} %</span>
          </header>

          <div className="question-form">
            <label className="question-field question-field--compact">
              <span>Type de question</span>
              <select
                onChange={(event) => {
                  const type = event.target.value as ReviewQuestion["type"];
                  changeQuestion({
                    type,
                    correctChoiceIds: isSingleAnswer(type)
                      ? question.correctChoiceIds.slice(0, 1)
                      : question.correctChoiceIds
                  });
                }}
                value={question.type}
              >
                <option value="single_choice">Choix unique</option>
                <option value="multiple_choice">Choix multiples</option>
                <option value="true_false">Vrai ou faux</option>
              </select>
            </label>

            <label className="question-field">
              <span>Titre <small>{originLabel(question.titleOrigin)}</small></span>
              <input
                onChange={(event) => changeQuestion({ title: event.target.value, titleOrigin: "provided_by_user" })}
                placeholder="Titre de la question"
                type="text"
                value={question.title}
              />
            </label>

            <label className="question-field">
              <span>Énoncé <small>Markdown et LaTeX autorisés</small></span>
              <textarea
                className="question-statement-input"
                onChange={(event) => changeQuestion({ statement: event.target.value })}
                rows={8}
                value={question.statement}
              />
            </label>

            {questionAssets.length > 0 && (
              <section className="review-assets review-assets--prominent" aria-label="Illustrations extraites de la question">
                <h4><ImageIcon /> Illustrations extraites</h4>
                <div className="review-assets__grid">
                  {questionAssets.map(({ candidate, asset }) => (
                    <article key={candidate.id}>
                      {asset !== undefined ? (
                        <img alt={candidate.altText} src={asset.previewUrl} />
                      ) : (
                        <div className="review-asset-placeholder"><ImageIcon /><span>Illustration indisponible</span></div>
                      )}
                      <div>
                        <strong>{candidate.altText}</strong>
                        <span>Page {candidate.sourcePage} · {candidate.role === "essential" ? "essentielle" : "décorative"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <fieldset className="choice-editor">
              <legend>Propositions et réponses correctes</legend>
              <div className="choice-editor__list">
                {question.choices.map((choice, index) => {
                  const checked = question.correctChoiceIds.includes(choice.id);
                  return (
                    <div className={`choice-editor__row${checked ? " choice-editor__row--correct" : ""}`} key={choice.id}>
                      <label className="choice-correct-control" title="Réponse correcte">
                        <input
                          checked={checked}
                          name={isSingleAnswer(question.type) ? `correct-${question.id}` : undefined}
                          onChange={() => toggleCorrectChoice(choice.id)}
                          type={isSingleAnswer(question.type) ? "radio" : "checkbox"}
                        />
                        <span>{String.fromCharCode(65 + index)}</span>
                      </label>
                      <input
                        aria-label={`Proposition ${index + 1}`}
                        onChange={(event) => changeChoice(choice.id, event.target.value)}
                        type="text"
                        value={choice.content}
                      />
                      <div className="choice-editor__actions">
                        <button aria-label="Monter" disabled={index === 0} onClick={() => moveChoice(choice.id, -1)} type="button">↑</button>
                        <button aria-label="Descendre" disabled={index === question.choices.length - 1} onClick={() => moveChoice(choice.id, 1)} type="button">↓</button>
                        <button
                          aria-label="Supprimer"
                          disabled={question.choices.length <= 2}
                          onClick={() => deleteChoice(choice.id)}
                          type="button"
                        ><TrashIcon /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="button button--secondary button--small" onClick={addChoice} type="button">
                <PlusIcon /> Ajouter une proposition
              </button>
            </fieldset>

            <label className="question-field question-field--compact">
              <span>Origine de la réponse correcte</span>
              <select
                onChange={(event) => {
                  const correctAnswerOrigin = event.target.value as ReviewQuestion["correctAnswerOrigin"];
                  changeQuestion({
                    correctAnswerOrigin,
                    correctChoiceIds: correctAnswerOrigin === "not_available" ? [] : question.correctChoiceIds
                  });
                }}
                value={question.correctAnswerOrigin}
              >
                <option value="explicit_in_document">Présente dans le document</option>
                <option value="inferred_by_model">Déduite par le modèle</option>
                <option value="provided_by_user">Fournie par l’utilisateur</option>
                <option value="not_available">Non disponible</option>
              </select>
            </label>

            <label className="question-field">
              <span>Feedback pédagogique <small>{originLabel(question.feedbackOrigin)}</small></span>
              <textarea
                onChange={(event) => changeQuestion({ feedback: event.target.value, feedbackOrigin: "provided_by_user" })}
                placeholder="Explication de la réponse et des erreurs fréquentes"
                required
                rows={6}
                value={question.feedback}
              />
            </label>

            {validationIssues.length > 0 && (
              <section className="review-warnings review-warnings--blocking" aria-label="Erreurs de validation">
                <h4><WarningIcon /> Corrections nécessaires avant validation</h4>
                <ul>{validationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </section>
            )}

            {question.warnings.length > 0 && (
              <section className="review-warnings" aria-label="Avertissements">
                <h4><WarningIcon /> Points à vérifier</h4>
                <ul>{question.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </section>
            )}
          </div>
        </section>
      </div>

      <footer className="question-review__navigation">
        <button
          className="button button--secondary"
          disabled={currentIndex === 0}
          onClick={() => onCurrentIndexChange(currentIndex - 1)}
          type="button"
        >
          <ChevronLeftIcon /> Précédente
        </button>
        <div className="review-navigation-status">
          <span>{currentIndex + 1} / {total}</span>
          <strong>{question.validated ? "Validée" : "À valider"}</strong>
        </div>
        {!isLast ? (
          <button
            className="button button--primary"
            onClick={() => onCurrentIndexChange(currentIndex + 1)}
            type="button"
          >
            Suivante <ChevronRightIcon />
          </button>
        ) : (
          <button
            className="button button--primary button--export"
            disabled={!allValidated || exporting}
            onClick={onExport}
            type="button"
          >
            <DownloadIcon /> {exporting ? "Préparation…" : "Exporter le ZIP"}
          </button>
        )}
      </footer>
      {isLast && !allValidated && (
        <p className="review-export-hint" role="status">
          Validez encore {total - validatedCount} question{total - validatedCount > 1 ? "s" : ""} pour activer l’export.
        </p>
      )}
    </section>
  );
}
