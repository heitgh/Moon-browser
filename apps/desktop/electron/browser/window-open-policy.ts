export type MoonWindowOpenDisposition =
  | "default"
  | "foreground-tab"
  | "background-tab"
  | "new-window"
  | "save-to-disk"
  | "other";

export type MoonWindowOpenDecision =
  | { readonly action: "deny" }
  | { readonly action: "tab"; readonly active: boolean }
  | { readonly action: "popup" };

export function decideWindowOpen(
  url: string,
  disposition: MoonWindowOpenDisposition,
): MoonWindowOpenDecision {
  if (!isSafeWebPopupUrl(url)) return { action: "deny" };
  if (disposition === "foreground-tab" || disposition === "default") {
    return { action: "tab", active: true };
  }
  if (disposition === "background-tab") return { action: "tab", active: false };
  if (disposition === "new-window" || disposition === "other")
    return { action: "popup" };
  return { action: "deny" };
}

export function isSafeWebPopupUrl(value: string): boolean {
  if (value === "about:blank") return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
