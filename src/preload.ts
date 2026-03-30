import { contextBridge, ipcRenderer } from "electron";

const quizApp = {
  login: (): Promise<{ authFile: string; currentUrl: string }> => ipcRenderer.invoke("quiz:login"),
  extract: (url: string): Promise<{ textFileName: string }> => ipcRenderer.invoke("quiz:extract", url),
  openExtractsFolder: (): Promise<string> => ipcRenderer.invoke("quiz:open-extracts-folder"),
};

contextBridge.exposeInMainWorld("quizApp", quizApp);
