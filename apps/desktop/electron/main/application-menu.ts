import { BrowserWindow, Menu, app, type MenuItemConstructorOptions } from "electron";
import { type ZoomAction } from "./interface-zoom.js";

export function installApplicationMenu(createPrivateWindow: () => void, onPageZoom: (window: BrowserWindow, action: ZoomAction) => void, onResources?: (window: BrowserWindow) => void): void {
  const zoomItem = (label: string, accelerator: string, action: ZoomAction): MenuItemConstructorOptions => ({
    label, accelerator,
    click: (_item, window) => { const browserWindow = window ? BrowserWindow.fromId(window.id) : BrowserWindow.getFocusedWindow(); if (browserWindow) onPageZoom(browserWindow, action); }
  });
  const template: MenuItemConstructorOptions[] = [
    { label: app.name, submenu: [{ label: "Nova janela anônima", accelerator: "CmdOrCtrl+Shift+N", click: createPrivateWindow }, { id: "moon-resources", label: "Recursos", accelerator: "CmdOrCtrl+Shift+E", click: (_item, window) => { if (window) { const host = BrowserWindow.fromId(window.id); if (host) onResources?.(host); } } }, { type: "separator" }, { role: "about" }, { type: "separator" }, { role: "quit" }] },
    { label: "Editar", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }] },
    { label: "Visualizar", submenu: [
      { role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" },
      zoomItem("Restaurar página (100%)", "CommandOrControl+0", "reset"),
      zoomItem("Aumentar página", "CommandOrControl+=", "in"),
      zoomItem("Diminuir página", "CommandOrControl+-", "out"),
      { role: "togglefullscreen" }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
