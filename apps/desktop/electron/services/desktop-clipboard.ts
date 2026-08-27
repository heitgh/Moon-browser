import { clipboard, nativeImage } from "electron";
import type { ClipboardContent, ClipboardFormat, ClipboardPlatform } from "@moon/platform";
export class DesktopClipboard implements ClipboardPlatform {
  async readText() { return clipboard.readText(); } async writeText(text: string) { clipboard.writeText(text); }
  async read(format: ClipboardFormat): Promise<ClipboardContent | null> { if (!(await this.has(format))) return null; if (format === "text") return { format, data: clipboard.readText() }; if (format === "html") return { format, data: clipboard.readHTML() }; if (format === "image") return { format, data: clipboard.readImage().toPNG() }; return { format, data: clipboard.read("text/uri-list").split("\n").filter(Boolean) }; }
  async write(content: ClipboardContent): Promise<void> { if (content.format === "text" && typeof content.data === "string") clipboard.writeText(content.data); else if (content.format === "html" && typeof content.data === "string") clipboard.writeHTML(content.data); else if (content.format === "image" && content.data instanceof Uint8Array) clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(content.data))); else if (content.format === "files" && Array.isArray(content.data)) clipboard.writeText(content.data.join("\n")); else throw new Error(`Invalid clipboard payload for ${content.format}`); }
  async has(format: ClipboardFormat) { const map = { text: "text/plain", html: "text/html", image: "image/png", files: "text/uri-list" } as const; return clipboard.availableFormats().includes(map[format]); } async clear() { clipboard.clear(); }
}
