import { describe, expect, it } from "vitest";
import { parseProfileDataMutation } from "../../packages/ipc/profile-data-contract.js";

describe("profile data IPC contract", () => {
  it("normalizes validated web links", () => {
    expect(parseProfileDataMutation({ type: "bookmark:save", value: { id: "bookmark-1", title: "Moon", url: "https://moon.test", time: 10 } })).toEqual({ type: "bookmark:save", value: { id: "bookmark-1", title: "Moon", url: "https://moon.test/", time: 10 } });
  });

  it("rejects script URLs and malformed identifiers", () => {
    expect(() => parseProfileDataMutation({ type: "history:record", value: { id: "history 1", title: "Hostil", url: "javascript:alert(1)", time: 10 } })).toThrow();
  });

  it("enforces bounded notes and workspace positions", () => {
    expect(() => parseProfileDataMutation({ type: "notes:save", content: "x".repeat(1_000_001) })).toThrow();
    expect(() => parseProfileDataMutation({ type: "workspace:save", value: { id: "workspace-1", name: "Produto", position: -1 } })).toThrow();
  });

  it("accepts explicit delete and clear operations", () => {
    expect(parseProfileDataMutation({ type: "bookmark:delete", id: "bookmark-1" })).toEqual({ type: "bookmark:delete", id: "bookmark-1" });
    expect(parseProfileDataMutation({ type: "history:clear" })).toEqual({ type: "history:clear" });
  });
});
