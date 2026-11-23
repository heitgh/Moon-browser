import type { WebContents, WebPreferences } from "electron";

// Keep the security invariant last so a new caller cannot override it.
export function secureWebPreferences(options: WebPreferences = {}): WebPreferences {
  return {
    ...options,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false
  };
}

export function denyWebviewAttachment(contents: WebContents): void {
  contents.on("will-attach-webview", event => event.preventDefault());
}

export function isWebNavigation(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}
