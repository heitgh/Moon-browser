import { open, lstat } from "node:fs/promises";
import { extname } from "node:path";

const executableExtensions = new Set([
  ".exe", ".msi", ".msp", ".msix", ".msixbundle", ".appx", ".appxbundle", ".com",
  ".bat", ".cmd", ".ps1", ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".hta",
  ".scr", ".lnk", ".url", ".reg", ".cpl", ".dll", ".jar", ".sh", ".bash", ".zsh",
  ".desktop", ".appimage", ".run", ".deb", ".rpm", ".pkg", ".pacman", ".command", ".py"
]);

export function mayExecute(filename: string, mimeType = ""): boolean {
  return executableExtensions.has(extname(filename.replace(/[. ]+$/, "")).toLowerCase()) ||
    /executable|msdownload|x-msi|x-shellscript|x-desktop|x-debian-package|x-rpm|java-archive/i.test(mimeType);
}

export async function inspectDownloadedFile(path: string, mimeType: string) {
  const original = await lstat(path);
  if (!original.isFile()) throw new Error("O download não aponta para um arquivo comum.");
  const handle = await open(path, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.dev !== original.dev || info.ino !== original.ino) throw new Error("O arquivo mudou. Confira o destino antes de abrir.");
    const bytes = Buffer.alloc(4);
    await handle.read(bytes, 0, bytes.length, 0);
    const magic = bytes.toString("hex");
    const executable = mayExecute(path, mimeType) ||
      magic.startsWith("4d5a") || magic.startsWith("2321") || magic === "7f454c46" ||
      ["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe", "bebafeca"].includes(magic) ||
      (process.platform !== "win32" && (info.mode & 0o111) !== 0);
    return { executable, identity: [info.dev, info.ino, info.mode, info.size, info.mtimeMs, info.ctimeMs].join(":") };
  } finally {
    await handle.close();
  }
}
