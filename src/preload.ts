import { contextBridge, ipcRenderer } from "electron";

const quizApp = {
  login: (): Promise<{ authFile: string; currentUrl: string }> => ipcRenderer.invoke("quiz:login"),
  extract: (url: string): Promise<{ outputPath: string }> => ipcRenderer.invoke("quiz:extract", url),
};

contextBridge.exposeInMainWorld("quizApp", quizApp);
