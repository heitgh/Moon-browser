const {contextBridge, ipcRenderer} = require("electron");
contextBridge.exposeInMainWorld("moonAccess", Object.freeze({unlock: password => ipcRenderer.invoke("access:unlock", password),
  onNotice: listener => { if (typeof listener !== "function") throw new TypeError("Listener inválido"); ipcRenderer.on("access:notice", (_event, message) => listener(message)); }
}));
