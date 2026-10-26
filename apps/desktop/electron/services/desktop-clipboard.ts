// Nexus Inc. — Electron 45 clipboard is asynchronous and uses MIME ClipboardItems.
import { clipboard, ClipboardItem } from "electron";
import type { ClipboardContent, ClipboardFormat, ClipboardPlatform } from "@moon/platform";
const mime = { text: "text/plain", html: "text/html", image: "image/png", files: "text/uri-list" } as const;
export class DesktopClipboard implements ClipboardPlatform {
  async readText(): Promise<string> { return clipboard.readText(); }
  async writeText(text: string): Promise<void> { await clipboard.writeText(text); }
  async read(format: ClipboardFormat): Promise<ClipboardContent | null> {
    const item = (await clipboard.read()).find(value => value.types.includes(mime[format]));
    if (!item) return null;
    const blob = await item.getType(mime[format]);
    if (format === "image") return { format, data: new Uint8Array(await blob.arrayBuffer()) };
    const text = await blob.text();
    return { format, data: format === "files" ? text.split(/\r?\n/).filter(line => line && !line.startsWith("#")) : text };
  }
  async write(content: ClipboardContent): Promise<void> {
    if ((content.format === "text" || content.format === "html") && typeof content.data === "string") {
      await clipboard.write([new ClipboardItem({ [mime[content.format]]: content.data })]);
    } else if (content.format === "image" && content.data instanceof Uint8Array) {
      await clipboard.write([new ClipboardItem({ "image/png": new Blob([new Uint8Array(content.data)], { type: "image/png" }) })]);
    } else if (content.format === "files" && Array.isArray(content.data)) {
      await clipboard.write([new ClipboardItem({ "text/uri-list": content.data.join("\n") })]);
    } else throw new Error(`Invalid clipboard payload for ${content.format}`);
  }
  async has(format: ClipboardFormat): Promise<boolean> { return clipboard.has(mime[format]); }
  async clear(): Promise<void> { clipboard.clear(); }
}
