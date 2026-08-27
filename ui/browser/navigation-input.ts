const HOST_PATTERN = /^(localhost|(?:\d{1,3}\.){3}\d{1,3}|[^\s/]+\.[^\s/]+)(?::\d+)?(?:\/.*)?$/i;

export function resolveNavigationInput(value: string): string {
  const input = value.trim();
  if (!input) return "moon://newtab";

  try {
    const url = new URL(input);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // A value without a scheme may still be a hostname or a search query.
  }

  if (HOST_PATTERN.test(input)) {
    const scheme = input.startsWith("localhost") || /^\d{1,3}(?:\.\d{1,3}){3}/.test(input)
      ? "http://"
      : "https://";
    return new URL(`${scheme}${input}`).toString();
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(input)}`;
}
