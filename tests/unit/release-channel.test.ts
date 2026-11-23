import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

function buildChannel(signed: string): string {
  return execFileSync(process.execPath, ["-e", "process.stdout.write(require('./electron-builder.channel.cjs').publish.channel)"], {
    cwd: process.cwd(),
    env: { ...process.env, MOON_RELEASE_SIGNED: signed }
  }).toString();
}

it("isolates signed update metadata from the legacy alpha feed", () => {
  expect(buildChannel("0")).toBe("alpha");
  expect(buildChannel("1")).toBe("signed-alpha");
});
