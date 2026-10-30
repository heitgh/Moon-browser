// Nexus Inc. — recovery window exposes only three controlled operations.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("moonRecovery", Object.freeze({
  list: () => ipcRenderer.invoke("recovery:list"),
  restore: id => ipcRenderer.invoke("recovery:restore", id),
  export: () => ipcRenderer.invoke("recovery:export"),
  fresh: () => ipcRenderer.invoke("recovery:fresh")
}));
