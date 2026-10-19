/* global window */
const { ipcRenderer } = require("electron");

// Nexus Inc. — reserve trusted Ctrl + wheel for interface zoom.
window.addEventListener("wheel", event => {
  if (!event.isTrusted || !event.ctrlKey || event.deltaY === 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  ipcRenderer.send("browser:ui-wheel", event.deltaY < 0 ? "in" : "out");
}, { capture: true, passive: false });
