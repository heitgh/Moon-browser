import { describe, expect, it } from "vitest";
import { resolveNavigationInput } from "../../ui/browser/navigation-input.js";

describe("resolveNavigationInput", () => {
  it("keeps secure URLs", () => {
    expect(resolveNavigationInput("https://example.com/docs")).toBe("https://example.com/docs");
  });

  it("adds HTTPS to public hostnames", () => {
    expect(resolveNavigationInput("example.com/path")).toBe("https://example.com/path");
  });

  it("uses HTTP for localhost development", () => {
    expect(resolveNavigationInput("localhost:4173")).toBe("http://localhost:4173/");
  });

  it("converts regular text into a private search", () => {
    expect(resolveNavigationInput("moon browser inteligente"))
      .toBe("https://duckduckgo.com/?q=moon%20browser%20inteligente");
  });

  it("does not navigate to executable protocols", () => {
    expect(resolveNavigationInput("javascript:alert(1)"))
      .toBe("https://duckduckgo.com/?q=javascript%3Aalert(1)");
  });

  it("maps empty values to Moon Home", () => {
    expect(resolveNavigationInput("  ")).toBe("moon://newtab");
  });
});
