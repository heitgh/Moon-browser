// Nexus Inc. — recoverable interface zoom, including ABNT and numpad keys.
import type { Input, WebContents } from "electron";

export type ZoomAction = "in" | "out" | "reset";
export function zoomAction(input: Pick<Input, "type" | "control" | "meta" | "alt" | "key" | "code">): ZoomAction | undefined {
  if (input.type !== "keyDown" || (!input.control && !input.meta) || input.alt) return;
  if (["+", "="].includes(input.key) || input.code === "NumpadAdd") return "in";
  if (input.key === "-" || input.code === "NumpadSubtract") return "out";
  if (input.key === "0" || input.code === "Numpad0") return "reset";
  return;
}

export function nextZoom(current: number, action: ZoomAction): number {
  if (action === "reset") return 1;
  const safe = Number.isFinite(current) ? current : 1;
  return Math.min(2, Math.max(.5, Math.round((safe + (action === "in" ? .1 : -.1)) * 10) / 10));
}

export function changeInterfaceZoom(contents: WebContents, action: ZoomAction): void {
  if (!contents.isDestroyed()) contents.setZoomFactor(nextZoom(contents.getZoomFactor(), action));
}

export function installZoomShortcuts(source: WebContents, onZoom: (action: ZoomAction) => void): void {
  source.on("before-input-event", (event, input) => {
    const action = zoomAction(input);
    if (!action) return;
    event.preventDefault();
    onZoom(action);
  });
}

export function installInterfaceWheel(source: WebContents, shell: WebContents): void {
  // Electron reports Ctrl + wheel here, including gestures over site iframes.
  source.on("zoom-changed", (event, direction) => {
    event.preventDefault();
    // Finish native wheel dispatch before resizing a different WebContents.
    setImmediate(() => changeInterfaceZoom(shell, direction));
  });
}
