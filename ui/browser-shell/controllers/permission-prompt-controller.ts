import type { MoonBrowserBridge, PermissionRequest, SitePermissionRecord } from "../contracts.js";
import { createPermissionPrompt } from "../components/permission-prompt.js";

export interface PermissionPromptControllerOptions {
  readonly container: HTMLElement;
  readonly bridge: MoonBrowserBridge;
  readonly onError: (error: unknown) => void;
  readonly onPermissionsChanged: (records: readonly SitePermissionRecord[]) => void;
  readonly onIdle: () => Promise<void> | void;
}

export class PermissionPromptController {
  readonly #queue: PermissionRequest[] = [];
  #activeRequest: PermissionRequest | undefined;

  constructor(readonly options: PermissionPromptControllerOptions) {}

  get active(): boolean { return Boolean(this.#activeRequest); }

  enqueue(request: PermissionRequest): void {
    this.#queue.push(request);
    void this.#showNext();
  }

  async #showNext(): Promise<void> {
    if (this.#activeRequest) return;
    const request = this.#queue.shift(); if (!request) return;
    this.#activeRequest = request;
    try { await this.options.bridge.setContentVisible(false); }
    catch (error) {
      this.options.onError(error);
      try { await this.options.bridge.respondToPermission(request.id, false); } catch (responseError) { this.options.onError(responseError); }
      await this.#finishCurrent();
      return;
    }
    let view: ReturnType<typeof createPermissionPrompt>;
    const respond = async (granted: boolean): Promise<void> => {
      view.disableActions();
      try {
        await this.options.bridge.respondToPermission(request.id, granted);
        this.options.onPermissionsChanged(await this.options.bridge.listSitePermissions());
      } catch (error) { this.options.onError(error); }
      view.element.remove();
      await this.#finishCurrent();
    };
    view = createPermissionPrompt(request, granted => { void respond(granted); });
    this.options.container.append(view.element);
  }

  async #finishCurrent(): Promise<void> {
    this.#activeRequest = undefined;
    try { if (this.#queue.length > 0) await this.#showNext(); else await this.options.onIdle(); }
    catch (error) { this.options.onError(error); }
  }
}
