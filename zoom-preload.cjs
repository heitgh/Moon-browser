/* global window, document, navigator, location, MutationObserver, crypto */
const { ipcRenderer } = require("electron");

// Nexus Inc. — reserve trusted Ctrl + wheel for interface zoom.
window.addEventListener("wheel", event => {
  if (!event.isTrusted || !event.ctrlKey || event.deltaY === 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  ipcRenderer.send("browser:ui-wheel", event.deltaY < 0 ? "in" : "out");
}, { capture: true, passive: false });

// Nexus Inc. — internal world only; no page-facing API or form values.
const { contextBridge } = require("electron");
// Missing capabilities leave suspension unverified instead of breaking wheel zoom.
if (typeof document !== "undefined" && typeof crypto !== "undefined" && typeof MutationObserver !== "undefined" && contextBridge?.exposeInIsolatedWorld) {
let resourceScriptSeen = Boolean(document.querySelector("script"));
let resourceInteraction = false;
let resourceMutation = false;
let resourceLoaded = false;
let resourceDeclarativeShadow = false;
let resourceInspectedNodes = 0;
const resourceDocumentId = Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
const inspectResourceNodes = records => {
  for (const record of records) {
    if (resourceLoaded) { resourceMutation = true; resourceObserver.disconnect(); return; }
    if (record.type === "attributes" && /^on/i.test(record.attributeName || "")) { resourceScriptSeen = true; resourceObserver.disconnect(); return; }
    for (const node of record.addedNodes || []) {
      if (node.nodeType !== 1) continue;
      // Inspect each inserted element once; do not repeatedly traverse a deep subtree.
      if (++resourceInspectedNodes > 10000 || node.attributes.length > 100) resourceDeclarativeShadow = true;
      else if (node.tagName === "SCRIPT" || [...node.attributes].some(attribute => /^on/i.test(attribute.name))) resourceScriptSeen = true;
      if (node.tagName === "TEMPLATE" || node.localName.includes("-") || node.hasAttribute("shadowrootmode")) resourceDeclarativeShadow = true;
      if (resourceScriptSeen || resourceDeclarativeShadow) { resourceObserver.disconnect(); return; }
    }
  }
};
const resourceObserver = new MutationObserver(inspectResourceNodes);
if (!resourceScriptSeen) resourceObserver.observe(document, {childList: true, subtree: true, attributes: true});
window.addEventListener("load", () => { inspectResourceNodes(resourceObserver.takeRecords()); resourceLoaded = true; }, {once: true});
for (const eventName of ["input", "change", "keydown", "pointerdown", "click", "submit", "beforeinput"]) {
  window.addEventListener(eventName, event => { if (event.isTrusted) { resourceInteraction = true; resourceObserver.disconnect(); } }, {capture: true, passive: true});
}
contextBridge.exposeInIsolatedWorld(1004, "moonResourceActivity", Object.freeze({snapshot: () => {
  inspectResourceNodes(resourceObserver.takeRecords());
  const reasons = [];
  const result = () => ({documentId: resourceDocumentId, url: location.href, eligible: reasons.length === 0, reasons, scrollX: window.scrollX, scrollY: window.scrollY});
  if (!resourceLoaded || document.readyState !== "complete") reasons.push("Documento ainda carregando.");
  if (document.contentType !== "text/html") reasons.push("Tipo de documento não homologado para recarga automática.");
  if (resourceScriptSeen || document.querySelector("script")) reasons.push("A página contém ou executou scripts.");
  if (resourceInteraction) reasons.push("Houve interação do usuário; o estado será preservado.");
  if (resourceMutation) reasons.push("A página alterou seu estado após carregar.");
  if (resourceDeclarativeShadow || window.opener || navigator.serviceWorker?.controller) reasons.push("Contexto complexo, vinculado ou controlado por serviço.");
  if (resourceScriptSeen || resourceInteraction || resourceMutation || resourceDeclarativeShadow) return result();
  if (document.querySelector('form,input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="textbox"],iframe,frame,canvas,video,audio,object,embed,details[open],meta[http-equiv="refresh" i]')) reasons.push("Formulário, mídia, quadro ou conteúdo com estado importante.");
  const elements = document.getElementsByTagName("*");
  if (elements.length > 10000) reasons.push("Documento grande demais para verificação conservadora.");
  else for (const element of elements) if ([...element.attributes].some(attribute => /^on/i.test(attribute.name))) { reasons.push("Há eventos de script no documento."); break; }
  return result();
}}));

}
