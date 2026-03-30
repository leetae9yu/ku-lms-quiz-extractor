import { extname, resolve } from "node:path";

import { JSDOM } from "jsdom";

export const DEFAULT_CANVAS_BASE_URL = "https://mylms.korea.ac.kr";

export interface CanvasQuizTextBlock {
  text: string;
  html?: string;
}

export interface CanvasQuizAnswer {
  index: number;
  text: string;
  html?: string;
  isCorrect: boolean;
  isSelected: boolean;
  comment?: CanvasQuizTextBlock;
}

export interface CanvasQuizQuestion {
  index: number;
  label?: string;
  text: string;
  html?: string;
  answers: CanvasQuizAnswer[];
  correctAnswerIndexes: number[];
  selectedAnswerIndexes: number[];
  questionComment?: CanvasQuizTextBlock;
}

export interface CanvasQuizMeta {
  title?: string;
  score?: string;
  submittedAt?: string;
  duration?: string;
}

export interface CanvasQuizExtraction {
  url: string;
  extractedAt: string;
  meta: CanvasQuizMeta;
  questions: CanvasQuizQuestion[];
}

export type CanvasQuizOutputFormat = "json" | "text";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value.replace(/&nbsp;/g, " ").trim();
}

function extractTextBlock(element: Element | null | undefined): CanvasQuizTextBlock | undefined {
  if (!element) {
    return undefined;
  }

  const text = collapseWhitespace(element.textContent ?? "");
  const html = collapseWhitespace(decodeHtml(element.innerHTML));

  if (text.length === 0 && html.length === 0) {
    return undefined;
  }

  return {
    text,
    html: html.length > 0 ? html : undefined,
  };
}

function firstNonEmptyBlock(root: ParentNode, selectors: string[]): CanvasQuizTextBlock | undefined {
  for (const selector of selectors) {
    const block = extractTextBlock(root.querySelector(selector));
    if (block && (block.text.length > 0 || (block.html?.length ?? 0) > 0)) {
      return block;
    }
  }

  return undefined;
}

function extractQuizMeta(document: Document): CanvasQuizMeta {
  const title = collapseWhitespace(document.querySelector("#quiz_title")?.textContent ?? "");
  const score = collapseWhitespace(document.querySelector(".quiz_score .score_value")?.textContent ?? "");

  const metaLines = Array.from(document.querySelectorAll<HTMLDivElement>(".quiz-submission > div"))
    .map((element) => collapseWhitespace(element.textContent ?? ""))
    .filter((line) => line.length > 0);

  const submittedAt = metaLines.find((line) => line.includes("제출"));
  const duration = collapseWhitespace(document.querySelector(".quiz_duration")?.textContent ?? "") || undefined;

  return {
    title: title.length > 0 ? title : undefined,
    score: score.length > 0 ? score : undefined,
    submittedAt,
    duration,
  };
}

function extractQuestionComment(questionElement: Element): CanvasQuizTextBlock | undefined {
  return firstNonEmptyBlock(questionElement, [
    ".question_comments .question_comment_html",
    ".question_comments .question_comment_text",
    ".question_comments .quiz_comment",
    ".after_answers .question_comment_html",
    ".after_answers .question_comment_text",
    ".after_answers .quiz_comment",
  ]);
}

export function extractCanvasQuizFromHtml(html: string, url: string): CanvasQuizExtraction {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const questionElements = Array.from(
    document.querySelectorAll<HTMLElement>(".question_holder .display_question.question"),
  );

  const questions = questionElements
    .map((questionElement, questionIndex) => {
      const label = collapseWhitespace(questionElement.querySelector(".question_name")?.textContent ?? "");
      const questionBlock = firstNonEmptyBlock(questionElement, [
        ".question_text.user_content",
        "[id^='question_'][id$='_question_text'].question_text",
        ".question_text",
      ]);

      const answerElements = Array.from(
        questionElement.querySelectorAll<HTMLElement>(
          ".answers_wrapper > .answer, .answers .answer, .answer_group .answer",
        ),
      );
      const extractedAnswers = answerElements
        .map((answerElement) => {
          const answerBlock = firstNonEmptyBlock(answerElement, [
            ".answer_html",
            ".answer_text",
            ".answer_match_left_html",
            ".answer_match_left",
          ]);

          const comment = firstNonEmptyBlock(answerElement, [
            ".quiz_comment .answer_comment_html",
            ".quiz_comment .answer_comment",
            ".answer_comment_html",
            ".answer_comment",
          ]);

          return {
            index: 0,
            text: answerBlock?.text ?? answerBlock?.html ?? "",
            html: answerBlock?.html,
            isCorrect: answerElement.classList.contains("correct_answer"),
            isSelected: answerElement.classList.contains("selected_answer"),
            comment,
          } satisfies CanvasQuizAnswer;
        })
        .filter((answer) => answer.text.length > 0 || (answer.html?.length ?? 0) > 0);

      const answers = extractedAnswers.map((answer, answerIndex) => ({
        ...answer,
        index: answerIndex + 1,
      }));

      return {
        index: questionIndex + 1,
        label: label.length > 0 ? label : undefined,
        text: questionBlock?.text ?? questionBlock?.html ?? "",
        html: questionBlock?.html,
        answers,
        correctAnswerIndexes: answers.filter((answer) => answer.isCorrect).map((answer) => answer.index),
        selectedAnswerIndexes: answers.filter((answer) => answer.isSelected).map((answer) => answer.index),
        questionComment: extractQuestionComment(questionElement),
      } satisfies CanvasQuizQuestion;
    })
    .filter((question) => question.text.length > 0 || (question.html?.length ?? 0) > 0);

  return {
    url,
    extractedAt: new Date().toISOString(),
    meta: extractQuizMeta(document),
    questions,
  };
}

export function isLikelyCanvasLoginPage(html: string, url: string): boolean {
  const loweredUrl = url.toLowerCase();
  if (loweredUrl.includes("/login") || loweredUrl.includes("/saml") || loweredUrl.includes("/cas")) {
    return true;
  }

  const dom = new JSDOM(html);
  const { document } = dom.window;

  return Boolean(
    document.querySelector("input[type='password']") ||
      document.querySelector("form[action*='login']") ||
      document.querySelector("a[href*='login']"),
  );
}

export function looksLikeCanvasQuizResults(extraction: CanvasQuizExtraction): boolean {
  return extraction.questions.length > 0;
}

function sanitizeFileStem(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned.length > 0 ? cleaned : `quiz-${Date.now()}`;
}

export function defaultCanvasQuizAuthFile(workspace: string): string {
  return resolve(workspace, ".canvas-quiz", "storage-state.json");
}

function formatFileExtension(format: CanvasQuizOutputFormat): ".json" | ".txt" {
  return format === "json" ? ".json" : ".txt";
}

export function defaultCanvasQuizOutputDirectory(workspace: string): string {
  return resolve(workspace, ".canvas-quiz", "extracts");
}

export function defaultCanvasQuizArtifactDirectory(workspace: string): string {
  return resolve(workspace, ".canvas-quiz", "artifacts");
}

export function defaultCanvasQuizOutputFile(
  workspace: string,
  extraction: CanvasQuizExtraction,
  format: CanvasQuizOutputFormat,
): string {
  const title = extraction.meta.title ?? extraction.questions[0]?.text ?? "quiz";
  const stem = sanitizeFileStem(title);
  return resolve(defaultCanvasQuizOutputDirectory(workspace), `${stem}${formatFileExtension(format)}`);
}

export function defaultCanvasQuizArtifactFile(workspace: string, extraction: CanvasQuizExtraction): string {
  const title = extraction.meta.title ?? extraction.questions[0]?.text ?? "quiz";
  const stem = sanitizeFileStem(title);
  return resolve(defaultCanvasQuizArtifactDirectory(workspace), `${stem}${formatFileExtension("json")}`);
}

export function resolveCanvasQuizFilePath(workspace: string, filePath: string): string {
  if (filePath.startsWith("/")) {
    return resolve(filePath);
  }

  return resolve(workspace, filePath);
}

export function ensureExtension(filePath: string, format: CanvasQuizOutputFormat): string {
  const expectedExtension = formatFileExtension(format);
  return extname(filePath).length > 0 ? filePath : `${filePath}${expectedExtension}`;
}

function questionLabel(question: CanvasQuizQuestion): string {
  return question.label ?? `문제 ${question.index}`;
}

function answerLine(answer: CanvasQuizAnswer): string {
  return `${answer.index}. ${answer.text}`;
}

function answerIndexesLabel(indexes: number[]): string {
  if (indexes.length === 0) {
    return "정보 없음";
  }

  return indexes.map((index) => `${index}번`).join(", ");
}

function explanationLine(question: CanvasQuizQuestion): string | undefined {
  const answerComment = question.answers.find((answer) => answer.comment?.text)?.comment?.text;
  const comment = answerComment ?? question.questionComment?.text;
  return comment ? `해설: ${comment}` : undefined;
}

export function formatCanvasQuizText(extraction: CanvasQuizExtraction): string {
  const lines: string[] = [];

  if (extraction.meta.title) {
    lines.push(extraction.meta.title);
    lines.push("");
  }

  for (const question of extraction.questions) {
    lines.push(questionLabel(question));
    lines.push(question.text);
    lines.push("");

    for (const answer of question.answers) {
      lines.push(answerLine(answer));
    }

    lines.push("");
    lines.push(`정답: ${answerIndexesLabel(question.correctAnswerIndexes)}`);

    const explanation = explanationLine(question);
    if (explanation) {
      lines.push(explanation);
    }

    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}
