import { Window } from "happy-dom";

// Node 26 exposes a native storage getter that shadows the DOM test environment.
// Tests use an isolated browser-like store, never Node's on-disk storage.
if (typeof window !== "undefined") {
  const dom = new Window({ url: "https://moon.test" });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: dom.localStorage });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: dom.sessionStorage });
}
