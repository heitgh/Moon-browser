import { expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { assertRecoveryDocument } from "../../apps/desktop/electron/ipc/recovery-ipc-policy.js";

it("accepts only the live recovery window's exact main document", () => {
  const root = resolve("moon-test");
  const frame = { url: pathToFileURL(join(root, "recovery.html")).href, detached: false };
  const sender = { mainFrame: frame, isDestroyed: () => false, getURL: () => frame.url };
  const window = { webContents: sender, isDestroyed: () => false };
  const check = (event: unknown, host: unknown = window) => assertRecoveryDocument(event as never, host as never, root);
  expect(() => check({sender, senderFrame: frame})).not.toThrow();
  expect(() => check({sender: {...sender}, senderFrame: frame})).toThrow();
  expect(() => check({sender, senderFrame: {...frame}})).toThrow();
  expect(() => check({sender, senderFrame: null})).toThrow();
  expect(() => check({sender, senderFrame: frame}, null)).toThrow();
  expect(() => check({sender, senderFrame: frame}, {...window, isDestroyed: () => true})).toThrow();
  frame.detached = true;
  expect(() => check({sender, senderFrame: frame})).toThrow();
  frame.detached = false;
  for (const url of ["https://evil.test", pathToFileURL(join(root, "index.html")).href, frame.url + "?x=1"]) {
    frame.url = url;
    expect(() => check({sender, senderFrame: frame})).toThrow();
  }
});
