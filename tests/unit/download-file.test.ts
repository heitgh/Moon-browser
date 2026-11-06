import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { inspectDownloadedFile, mayExecute } from "../../apps/desktop/electron/security/download-file.js";

it("recognizes risky suffixes and disguised executable bytes without launching the file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "moon-download-inspection-"));
  try {
    const disguised = join(dir, "report.pdf");
    const plain = join(dir, "notes.txt");
    await writeFile(disguised, Buffer.from([0x4d, 0x5a, 0x00, 0x00]));
    await writeFile(plain, "A regular note");
    expect(mayExecute("Installer.ExE ")).toBe(true);
    expect(mayExecute("plugin.zip", "application/x-msdownload")).toBe(true);
    expect((await inspectDownloadedFile(disguised, "application/pdf")).executable).toBe(true);
    expect((await inspectDownloadedFile(plain, "text/plain")).executable).toBe(false);
    await expect(inspectDownloadedFile(dir, "")).rejects.toThrow("arquivo comum");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
