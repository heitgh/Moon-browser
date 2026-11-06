import { expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import type { PageActivity } from "../../packages/ipc/resource-policy-contract.js";
function fixture(html = "<p>Read only</p>") {
  const window = new Window({url: "https://example.com/read"});
  window.document.body.innerHTML = html;
  Object.defineProperty(window.document, "readyState", {value: "complete", configurable: true});
  let api!: {snapshot(): PageActivity}; const exposed = vi.fn((world: number, name: string, value: typeof api) => { expect(world).toBe(1004); expect(name).toBe("moonResourceActivity"); api = value; });
  runInNewContext(readFileSync("zoom-preload.cjs", "utf8"), {window, document: window.document, navigator: window.navigator, location: window.location, MutationObserver: window.MutationObserver, crypto: webcrypto, require: () => ({ipcRenderer: {send: vi.fn()}, contextBridge: {exposeInIsolatedWorld: exposed}})});
  const load = () => window.dispatchEvent(new window.Event("load"));
  return {window, snapshot: () => api.snapshot(), load, close: () => window.happyDOM.abort()};
}
it("exposes activity only in the internal world and does not approve an unfinished document", async () => {
  const f = fixture(); try { expect(f.snapshot().eligible).toBe(false); f.load(); expect(f.snapshot().eligible).toBe(true); expect((f.window as unknown as {moonResourceActivity?: unknown}).moonResourceActivity).toBeUndefined(); } finally { await f.close(); }
});
it("remembers a script inserted and removed before load", async () => {
  const f = fixture(); try {
    const script = f.window.document.createElement("script"); f.window.document.body.append(script); script.remove();
    f.load(); expect(f.snapshot().reasons).toContain("A página contém ou executou scripts.");
  } finally { await f.close(); }
});
it("protects forms, frames, canvas and media without reading input values", async () => {
  for (const html of ['<input type="password" value="never-read-secret">', '<iframe></iframe>', '<canvas></canvas>', '<video></video>']) {
    const f = fixture(html); try { f.load(); const sample = f.snapshot(); expect(sample.eligible).toBe(false); expect(JSON.stringify(sample)).not.toContain("never-read-secret"); } finally { await f.close(); }
  }
});
it("protects post-load document mutations and inline script handlers", async () => {
  const f = fixture(); try { f.load(); f.window.document.body.append(f.window.document.createElement("p")); expect(f.snapshot().reasons).toContain("A página alterou seu estado após carregar."); } finally { await f.close(); }
  const g = fixture('<p onclick="alert(1)">Handler</p>'); try { g.load(); expect(g.snapshot().eligible).toBe(false); } finally { await g.close(); }
});
it("remembers an inline handler removed before load", async () => {
  const f = fixture(); try {
    const node = f.window.document.createElement("p"); f.window.document.body.append(node); node.setAttribute("onclick", "state()"); node.removeAttribute("onclick");
    f.load(); expect(f.snapshot().eligible).toBe(false);
  } finally { await f.close(); }
});
