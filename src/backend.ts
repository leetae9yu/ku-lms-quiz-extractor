import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import {
  DEFAULT_CANVAS_BASE_URL,
  defaultCanvasQuizAuthFile,
  defaultCanvasQuizOutputFile,
  ensureExtension,
  extractCanvasQuizFromHtml,
  isLikelyCanvasLoginPage,
  looksLikeCanvasQuizResults,
  resolveCanvasQuizFilePath,
  type CanvasQuizExtraction,
} from "./lib/canvas-quiz.js";

export interface LoginResult {
  authFile: string;
  currentUrl: string;
}

export interface ExtractResult {
  outputPath: string;
  extraction: CanvasQuizExtraction;
}

export interface BackendOptions {
  workspace: string;
  baseUrl?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCompletedLogin(page: Page, baseUrl: string, timeoutMs: number): Promise<{ currentUrl: string; html: string }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const currentUrl = page.url();

    try {
      const html = await page.content();
      if (currentUrl.startsWith(baseUrl) && !isLikelyCanvasLoginPage(html, currentUrl)) {
        return { currentUrl, html };
      }
    } catch {
      // Ignore transient navigation states while the user is logging in.
    }

    if (page.isClosed()) {
      throw new Error("로그인 창이 닫혔습니다. 다시 시도하세요.");
    }

    await sleep(1000);
  }

  throw new Error("로그인 시간이 초과되었습니다. 다시 시도하세요.");
}

export async function loginToCanvas(options: BackendOptions): Promise<LoginResult> {
  const workspace = resolveCanvasQuizFilePath(options.workspace, ".");
  const baseUrl = options.baseUrl ?? DEFAULT_CANVAS_BASE_URL;
  const authFile = resolveCanvasQuizFilePath(workspace, defaultCanvasQuizAuthFile(workspace));

  await mkdir(dirname(authFile), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const { currentUrl } = await waitForCompletedLogin(page, baseUrl, 300_000);
    await context.storageState({ path: authFile });
    return { authFile, currentUrl };
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

function serializeExtraction(extraction: CanvasQuizExtraction): string {
  return `${JSON.stringify(extraction, null, 2)}\n`;
}

export async function extractQuiz(url: string, options: BackendOptions): Promise<ExtractResult> {
  const workspace = resolveCanvasQuizFilePath(options.workspace, ".");
  const baseUrl = options.baseUrl ?? DEFAULT_CANVAS_BASE_URL;
  const authFile = resolveCanvasQuizFilePath(workspace, defaultCanvasQuizAuthFile(workspace));

  try {
    await access(authFile);
  } catch {
    throw new Error(`저장된 로그인 세션이 없습니다. 먼저 LMS 로그인 버튼을 눌러 주세요. (${authFile})`);
  }

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);

    const currentUrl = page.url();
    const html = await page.content();

    if (!currentUrl.startsWith(baseUrl)) {
      throw new Error(`예상한 LMS 페이지가 아닙니다: ${currentUrl}`);
    }

    if (isLikelyCanvasLoginPage(html, currentUrl)) {
      throw new Error("로그인 세션이 만료되었습니다. LMS 로그인 버튼을 다시 눌러 주세요.");
    }

    const extraction = extractCanvasQuizFromHtml(html, currentUrl);
    if (!looksLikeCanvasQuizResults(extraction)) {
      throw new Error("퀴즈 결과 페이지를 찾지 못했습니다. 시도 이력/결과 페이지 URL인지 확인해 주세요.");
    }

    const outputPath = ensureExtension(defaultCanvasQuizOutputFile(workspace, extraction, "json"), "json");
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serializeExtraction(extraction), "utf8");

    return { outputPath, extraction };
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
