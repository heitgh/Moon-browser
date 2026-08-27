import { describe, expect, it } from "vitest";
import { MoonThemeValidationError, validateMoonTheme } from "../../packages/theme-contract/index.js";
import { moonThemeFixture } from "../fixtures/moon-themes/fixture-factory.js";

function expectCode(action: () => unknown, code: string): void {
  try { action(); throw new Error("O fixture deveria ter sido rejeitado."); }
  catch (error) { expect(error).toBeInstanceOf(MoonThemeValidationError); expect((error as MoonThemeValidationError).code).toBe(code); }
}

describe(".moontheme v1 contract", () => {
  it("validates a signed, compatible package without trusting an unknown publisher", () => {
    const result = validateMoonTheme(moonThemeFixture(), "0.1.0");
    expect(result.manifest.id).toBe("fixture.theme");
    expect(result.trust).toBe("local");
    expect(result.tokens.colors?.accent).toBe("#7c5cff");
  });

  it("rejects hash and signature tampering", () => {
    expectCode(() => validateMoonTheme(moonThemeFixture({ corruptHash: true }), "0.1.0"), "integrity");
    expectCode(() => validateMoonTheme(moonThemeFixture({ corruptSignature: true }), "0.1.0"), "signature");
  });

  it("rejects incompatible versions, traversal and undeclared content", () => {
    expectCode(() => validateMoonTheme(moonThemeFixture({ minimumVersion: "9.0.0" }), "0.1.0"), "incompatible");
    expectCode(() => validateMoonTheme(moonThemeFixture({ extraEntries: { "../escape.txt": Buffer.from("no") } }), "0.1.0"), "unsafe-path");
    expectCode(() => validateMoonTheme(moonThemeFixture({ extraEntries: { "assets/hidden.png": Buffer.from("no") } }), "0.1.0"), "undeclared-file");
  });

  it("rejects ZIP bomb-sized entries before accepting package content", () => {
    expectCode(() => validateMoonTheme(moonThemeFixture({ extraEntries: { "assets/bomb.webp": Buffer.alloc(4 * 1024 * 1024 + 1) } }), "0.1.0"), "zip-bomb");
  });

  it("rejects active SVG and false MIME content", () => {
    const unsafeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expectCode(() => validateMoonTheme(moonThemeFixture({ theme: { icons: { logo: "assets/logo.svg" } }, assets: { "assets/logo.svg": { bytes: unsafeSvg, mime: "image/svg+xml" } } }), "0.1.0"), "unsafe-svg");
    expectCode(() => validateMoonTheme(moonThemeFixture({ assets: { "assets/fake.png": { bytes: Buffer.from("not png"), mime: "image/png" } } }), "0.1.0"), "mime");
  });

  it("rejects unknown theme properties instead of forwarding arbitrary values", () => {
    expectCode(() => validateMoonTheme(moonThemeFixture({ theme: { css: "body { display: none }" } }), "0.1.0"), "schema");
  });
});
