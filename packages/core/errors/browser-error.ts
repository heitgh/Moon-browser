import {
  MoonError,
  type MoonErrorContext,
  type MoonErrorOptions
} from "./moon-error.js";

export type BrowserErrorCode =
  | "BROWSER_INITIALIZATION_FAILED"
  | "WINDOW_NOT_FOUND"
  | "WINDOW_CREATION_FAILED"
  | "TAB_NOT_FOUND"
  | "TAB_CREATION_FAILED"
  | "NAVIGATION_FAILED"
  | "NAVIGATION_BLOCKED"
  | "PAGE_CAPTURE_FAILED"
  | "SCRIPT_EXECUTION_FAILED"
  | "BROWSER_SHUTDOWN_FAILED";

export interface BrowserErrorOptions extends MoonErrorOptions {
  readonly windowId?: string;
  readonly tabId?: string;
  readonly url?: string;
}

export class BrowserError extends MoonError {
  readonly windowId?: string;
  readonly tabId?: string;
  readonly url?: string;

  constructor(
    code: BrowserErrorCode,
    message: string,
    options: BrowserErrorOptions = {}
  ) {
    const browserContext: MoonErrorContext = {
      ...options.context,
      ...(options.windowId ? { windowId: options.windowId } : {}),
      ...(options.tabId ? { tabId: options.tabId } : {}),
      ...(options.url ? { url: options.url } : {})
    };

    super(code, message, {
      cause: options.cause,
      context: browserContext,
      recoverable: options.recoverable
    });

    this.name = "BrowserError";
    this.windowId = options.windowId;
    this.tabId = options.tabId;
    this.url = options.url;
  }
}
