export type MoonWindowOpenDisposition =
  | "default"
  | "foreground-tab"
  | "background-tab"
  | "new-window"
  | "save-to-disk"
  | "other";

export interface MoonWindowOpenContext {
  readonly features?: string;
  readonly frameName?: string;
}

export type MoonWindowOpenDecision =
  | { readonly action: "deny" }
  | { readonly action: "tab"; readonly active: boolean }
  | { readonly action: "popup" };

const AUTH_HOSTS = new Set([
  "accounts.google.com",
  "appleid.apple.com",
  "login.live.com",
  "www.facebook.com",
  "m.facebook.com",
  "api.twitter.com",
  "twitter.com",
  "x.com",
  "id.twitch.tv",
  "github.com",
  "auth.pinterest.com",
]);

export function decideWindowOpen(
  url: string,
  disposition: MoonWindowOpenDisposition,
  context: MoonWindowOpenContext = {},
): MoonWindowOpenDecision {
  if (!isSafeWebPopupUrl(url)) return { action: "deny" };
  if (isAuthenticationPopupUrl(url) || looksLikeScriptedPopup(context)) {
    return { action: "popup" };
  }
  if (disposition === "foreground-tab" || disposition === "default") {
    return { action: "tab", active: true };
  }
  if (disposition === "background-tab") return { action: "tab", active: false };
  if (disposition === "new-window" || disposition === "other")
    return { action: "popup" };
  return { action: "deny" };
}

export function isAuthenticationPopupUrl(value: string): boolean {
  if (value === "about:blank") return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = `${url.pathname}${url.search}`.toLowerCase();
    return (
      AUTH_HOSTS.has(host) ||
      /(^|\.)(auth|login|accounts?)\./.test(host) ||
      /\/(oauth2?|authorize|signin|login|sso)(\/|\?|$)/.test(path) ||
      /[?&](client_id|redirect_uri|response_type|code_challenge)=/.test(path)
    );
  } catch {
    return false;
  }
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

function looksLikeScriptedPopup(context: MoonWindowOpenContext): boolean {
  return Boolean(context.features?.trim() || context.frameName?.trim());
}
