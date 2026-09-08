import { describe, expect, it } from "vitest";
import { parseProfileDataMutation } from "../../packages/ipc/profile-data-contract.js";

describe("profile data contract", () => {
  it("upgrades legacy history mutations to the versioned timeline schema", () => {
    expect(parseProfileDataMutation({ type: "history:record", value: { id: "visit-1", title: "Moon", url: "https://moon.test", time: 42 } })).toEqual({
      type: "history:record",
      value: { id: "visit-1", title: "Moon", url: "https://moon.test/", time: 42, schemaVersion: 2, startedAt: 42, source: "navigation", navigationType: "other" }
    });
  });

  it("validates rich history context and deletion ranges", () => {
    const mutation = parseProfileDataMutation({ type: "history:record", value: { id: "visit-2", title: "Docs", url: "https://docs.test/", time: 100, schemaVersion: 2, startedAt: 100, endedAt: 160, durationMs: 60, profileId: "default", workspaceId: "research", sessionId: "session-1", tabId: "tab-1", source: "navigation", navigationType: "typed" } });
    expect(mutation).toMatchObject({ type: "history:record", value: { durationMs: 60, profileId: "default", workspaceId: "research", navigationType: "typed" } });
    expect(parseProfileDataMutation({ type: "history:delete-range", from: 10, to: 20 })).toEqual({ type: "history:delete-range", from: 10, to: 20 });
    expect(() => parseProfileDataMutation({ type: "history:delete-range", from: 20, to: 10 })).toThrow(/range/i);
  });

  it("validates version-aware Moon Notes mutations", () => {
    expect(parseProfileDataMutation({ type: "note:save", expectedRevision: 2, value: { id: "note-one", kind: "note", title: " Produto ", content: "# Roadmap\n[[Pesquisa]]", format: "markdown", pinned: false, favorite: true, tags: ["startup", "startup"] } })).toEqual({ type: "note:save", expectedRevision: 2, value: { id: "note-one", kind: "note", title: "Produto", content: "# Roadmap\n[[Pesquisa]]", format: "markdown", pinned: false, favorite: true, tags: ["startup"] } });
    expect(() => parseProfileDataMutation({ type: "note:save", expectedRevision: -1, value: {} })).toThrow();
    expect(() => parseProfileDataMutation({ type: "note:save", expectedRevision: 0, value: { id: "note-one", title: "x", content: "x", tags: [], sourceUrl: "javascript:alert(1)" } })).toThrow(/URL/i);
  });
});
