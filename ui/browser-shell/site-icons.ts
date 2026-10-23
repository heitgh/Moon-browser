// Nexus Inc. — bundled icons never depend on an external favicon service.
export function builtinSiteIcon(value: string): string | undefined {
  try {
    const url = new URL(value); if (!["https:", "http:"].includes(url.protocol)) return;
    const host = url.hostname.toLowerCase();
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(host)) return "./assets/icons/youtube.svg";
    if (["github.com", "www.github.com"].includes(host)) return "./assets/icons/github.svg";
  } catch { /* Internal and malformed URLs use a text fallback. */ }
  return;
}
