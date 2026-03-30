import { app, BrowserWindow, ipcMain, shell } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { extractQuiz, loginToCanvas } from "./backend.js";
import { defaultCanvasQuizOutputDirectory } from "./lib/canvas-quiz.js";
import { uiHtml } from "./ui.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

function appWorkspace(): string {
  return join(app.getPath("userData"), "workspace");
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 760,
    height: 520,
    resizable: false,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: join(currentDir, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  const html = `data:text/html;charset=UTF-8,${encodeURIComponent(uiHtml)}`;
  void window.loadURL(html);
  return window;
}

async function bootstrap(): Promise<void> {
  ipcMain.handle("quiz:login", async () => loginToCanvas({ workspace: appWorkspace() }));
  ipcMain.handle("quiz:extract", async (_event, url: string) => extractQuiz(url, { workspace: appWorkspace() }));
  ipcMain.handle("quiz:open-extracts-folder", async () => {
    const directory = defaultCanvasQuizOutputDirectory(appWorkspace());
    const error = await shell.openPath(directory);
    if (error) {
      throw new Error(error);
    }

    return directory;
  });

  await app.whenReady();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void bootstrap();
