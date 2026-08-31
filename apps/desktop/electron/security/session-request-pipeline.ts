import type { CallbackResponse, HeadersReceivedResponse, OnBeforeRequestListenerDetails, OnHeadersReceivedListenerDetails, Session } from "electron";

export interface SessionRequestPolicy {
  readonly id: string;
  beforeRequest?(details: OnBeforeRequestListenerDetails): Promise<CallbackResponse | void> | CallbackResponse | void;
  headersReceived?(details: OnHeadersReceivedListenerDetails): Promise<HeadersReceivedResponse | void> | HeadersReceivedResponse | void;
}

export class SessionRequestPipeline {
  readonly #policies = new Map<string, SessionRequestPolicy>();
  readonly #sessions = new WeakSet<Session>();

  register(policy: SessionRequestPolicy): () => void {
    if (this.#policies.has(policy.id)) throw new Error(`Request policy already registered: ${policy.id}`);
    this.#policies.set(policy.id, policy);
    return () => { this.#policies.delete(policy.id); };
  }

  attach(session: Session): void {
    if (this.#sessions.has(session)) return;
    this.#sessions.add(session);
    session.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
      void this.#runBeforeRequest(details).then(callback, error => { console.error("Moon request policy failed", error); callback({}); });
    });
    session.webRequest.onHeadersReceived({ urls: ["<all_urls>"] }, (details, callback) => {
      void this.#runHeadersReceived(details).then(callback, error => { console.error("Moon response policy failed", error); callback({}); });
    });
  }

  async #runBeforeRequest(details: OnBeforeRequestListenerDetails): Promise<CallbackResponse> {
    let result: CallbackResponse = {};
    for (const policy of this.#policies.values()) {
      const next = await policy.beforeRequest?.(details);
      if (!next) continue;
      result = { ...result, ...next };
      if (result.cancel) break;
    }
    return result;
  }

  async #runHeadersReceived(details: OnHeadersReceivedListenerDetails): Promise<HeadersReceivedResponse> {
    let result: HeadersReceivedResponse = {};
    let current = details;
    for (const policy of this.#policies.values()) {
      const next = await policy.headersReceived?.(current);
      if (!next) continue;
      result = { ...result, ...next, responseHeaders: next.responseHeaders ?? result.responseHeaders };
      if (result.cancel) break;
      if (result.responseHeaders) current = { ...current, responseHeaders: Object.fromEntries(Object.entries(result.responseHeaders).map(([name, value]) => [name, Array.isArray(value) ? value : [value]])) };
    }
    return result;
  }
}
