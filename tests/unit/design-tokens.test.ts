import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = ["variables", "shell", "home", "panels", "settings", "customization-runtime"]
  .map(name => readFileSync(new URL(`../../ui/styles/${name}.css`, import.meta.url), "utf8"));

describe("Moon semantic design system", () => {
  it("defines the typography, spacing, target, focus and motion foundations", () => {
    const variables = styles[0]!;
    for (const token of [
      "--moon-font-ui", "--moon-font-body", "--moon-space-1", "--moon-space-10",
      "--moon-control-height", "--moon-focus-ring", "--moon-motion-instant",
      "--moon-motion-deliberate", "--moon-ease-standard"
    ]) expect(variables).toContain(token);
  });

  it("keeps literal text sizes in active styles at or above the 11px metadata floor", () => {
    const sizes = styles.flatMap(source => [...source.matchAll(/font-size:\s*(\d+)px/g)].map(match => Number(match[1])));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11);
  });

  it("does not use broad transition-all rules in the active system", () => {
    expect(styles.join("\n")).not.toMatch(/transition:\s*all\b/);
  });
});
