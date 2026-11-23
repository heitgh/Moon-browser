import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

function check(platform: string, supplied: Record<string, string> = {}) {
  const env = { ...process.env,
    CSC_LINK: "", CSC_KEY_PASSWORD: "", MOON_WINDOWS_PUBLISHER_NAME: "",
    LINUX_UPDATE_SIGNING_KEY_B64: "", LINUX_GPG_PRIVATE_KEY_B64: "", LINUX_GPG_FINGERPRINT: "", LINUX_GPG_PASSPHRASE: "",
    ...supplied
  };
  return spawnSync(process.execPath, ["scripts/release/check-signing-prerequisites.mjs", platform], { cwd: process.cwd(), env, encoding: "utf8" });
}

it("reports all missing repository secret names without showing supplied values", () => {
  const windows = check("win32", { CSC_LINK: "private-test-value" });
  expect(windows.status).toBe(1);
  expect(windows.stderr).toContain("WINDOWS_CSC_KEY_PASSWORD, WINDOWS_PUBLISHER_NAME");
  expect(windows.stderr).not.toContain("private-test-value");

  const linux = check("linux");
  expect(linux.status).toBe(1);
  for (const name of ["LINUX_UPDATE_SIGNING_KEY_B64", "LINUX_GPG_PRIVATE_KEY_B64", "LINUX_GPG_FINGERPRINT", "LINUX_GPG_PASSPHRASE"]) expect(linux.stderr).toContain(name);
});

it("allows a signed build only when its platform prerequisites are present", () => {
  expect(check("win32", { CSC_LINK: "pfx", CSC_KEY_PASSWORD: "password", MOON_WINDOWS_PUBLISHER_NAME: "CN=Publisher" }).status).toBe(0);
  expect(check("linux", { LINUX_UPDATE_SIGNING_KEY_B64: "key", LINUX_GPG_PRIVATE_KEY_B64: "gpg", LINUX_GPG_FINGERPRINT: "fingerprint", LINUX_GPG_PASSPHRASE: "passphrase" }).status).toBe(0);
  expect(check("other").status).toBe(2);
});
