import { describe, expect, it } from "vitest";
import { parseCreateLocalProfile, parseDeleteLocalProfile, parseUpdateLocalProfile, validateLocalProfileSummary } from "../../packages/ipc/local-profile-contract.js";

describe("local profile contract", () => {
  it("normalizes bounded profile metadata", () => {
    expect(parseCreateLocalProfile({ name: "  Produto  ", avatar: "briefcase", color: "#AABBCC" })).toEqual({ name: "Produto", avatar: "briefcase", color: "#aabbcc" });
    expect(parseUpdateLocalProfile({ id: "profile-123", name: "Pessoal", avatar: "person", color: "#123456" }).id).toBe("profile-123");
    expect(parseDeleteLocalProfile({ id: "profile-123", confirmation: "Pessoal", backup: true }).backup).toBe(true);
  });

  it("rejects traversal, invalid colors and inconsistent timestamps", () => {
    expect(() => parseUpdateLocalProfile({ id: "../profile", name: "X", avatar: "moon", color: "#123456" })).toThrow();
    expect(() => parseCreateLocalProfile({ name: "X", avatar: "moon", color: "red" })).toThrow();
    expect(() => validateLocalProfileSummary({ id: "default", name: "Padrão", avatar: "moon", color: "#123456", kind: "persistent", default: true, createdAt: -1, lastUsedAt: 1 })).toThrow();
  });
});
