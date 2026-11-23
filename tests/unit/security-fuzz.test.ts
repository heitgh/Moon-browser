import { expect, it } from "vitest";
import { isWebNavigation } from "../../apps/desktop/electron/security/web-preferences.js";
import { assertBoundedPayload } from "../../apps/desktop/electron/ipc/ipc-policy.js";

function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000);
}

it("rejects mutated privileged URL schemes and credential-bearing URLs", () => {
  const random = generator(0x4d4f4f4e);
  const unsafe = ["file", "javascript", "data", "chrome", "devtools", "blob", "moon"];
  for (let index = 0; index < 1_000; index++) {
    const scheme = unsafe[Math.floor(random() * unsafe.length)]!;
    const mixed = [...scheme].map(char => random() < 0.5 ? char.toUpperCase() : char).join("");
    const value = `${random() < 0.5 ? "\t" : ""}${mixed}:${random() < 0.5 ? "//" : ""}example.com/path`;
    expect(isWebNavigation(value), value).toBe(false);
    expect(isWebNavigation(`https://user${index}:secret@example.com/`)).toBe(false);
  }
});

it("rejects malformed IPC values across a deterministic nested corpus", () => {
  const random = generator(0x49504331);
  const invalid: readonly unknown[] = [NaN, Infinity, -Infinity, 1n, new Date(), new Set(), () => 1];
  for (let index = 0; index < 500; index++) {
    const payload: unknown = { valid: { nested: ["x".repeat(Math.floor(random() * 32)), index] }, extra: invalid[Math.floor(random() * invalid.length)] };
    expect(() => assertBoundedPayload(payload)).toThrow(TypeError);
  }
  expect(() => assertBoundedPayload({ nested: ["valid", 1, true, null] })).not.toThrow();
});
