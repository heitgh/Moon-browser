import type { CallbackResponse, HeadersReceivedResponse, OnBeforeRequestListenerDetails, OnBeforeSendHeadersListenerDetails, OnHeadersReceivedListenerDetails, Session } from "electron";

type RequestHeaderResult = { readonly cancel?: boolean; readonly requestHeaders?: Record<string, string> };

export interface SessionRequestPolicy {
  readonly id: string;
  beforeRequest?(details: OnBeforeRequestListenerDetails, session: Session): Promise<CallbackResponse | void> | CallbackResponse | void;
  beforeSendHeaders?(details: OnBeforeSendHeadersListenerDetails, session: Session): RequestHeaderResult | void;
  headersReceived?(details: OnHeadersReceivedListenerDetails, session: Session): Promise<HeadersReceivedResponse | void> | HeadersReceivedResponse | void;
}

export class SessionRequestPipeline {
  readonly #policies = new Map<string, SessionRequestPolicy>();
  readonly #sessions = new WeakSet<Session>();

  constructor(readonly policyTimeoutMs = 1_500) {}

  register(policy: SessionRequestPolicy): () => void {
    if (this.#policies.has(policy.id)) throw new Error(`Request policy already registered: ${policy.id}`);
    this.#policies.set(policy.id, policy);
    return () => { this.#policies.delete(policy.id); };
  }

  attach(session: Session): void {
    if (this.#sessions.has(session)) return;
    this.#sessions.add(session);
    session.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
      void this.#runBeforeRequest(details, session).then(callback, error => { console.error("Moon request policy failed", error); callback({}); });
    });
    session.webRequest.onBeforeSendHeaders({ urls: ["<all_urls>"] }, (details, callback) => {
      let result: RequestHeaderResult = {};
      for (const policy of this.#policies.values()) {
        if (!policy.beforeSendHeaders) continue;
        try {
          const next = policy.beforeSendHeaders({ ...details, requestHeaders: result.requestHeaders ?? details.requestHeaders }, session);
          if (next) result = { ...result, ...next };
          if (result.cancel) break;
        } catch (error) {
          console.error("Moon request header policy failed", error);
          result = { cancel: true };
          break;
        }
      }
      callback(result);
    });
    session.webRequest.onHeadersReceived({ urls: ["<all_urls>"] }, (details, callback) => {
      void this.#runHeadersReceived(details, session).then(callback, error => { console.error("Moon response policy failed", error); callback({}); });
    });
  }

  async #runBeforeRequest(details: OnBeforeRequestListenerDetails, session: Session): Promise<CallbackResponse> {
    let result: CallbackResponse = {};
    for (const policy of this.#policies.values()) {
      if (!policy.beforeRequest) continue;
      const next = await this.#runPolicy(policy.id, () => policy.beforeRequest!(details, session));
      if (!next) continue;
      result = { ...result, ...next };
      if (result.cancel) break;
    }
    return result;
  }

  async #runPolicy<T>(id: string, run: () => Promise<T | void> | T | void): Promise<T | void> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(run),
        new Promise<void>(resolve => {
          timeout = setTimeout(() => {
            console.warn(`Moon request policy timed out: ${id}`);
            resolve();
          }, this.policyTimeoutMs);
        })
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  async #runHeadersReceived(details: OnHeadersReceivedListenerDetails, session: Session): Promise<HeadersReceivedResponse> {
    let result: HeadersReceivedResponse = {};
    let current = details;
    for (const policy of this.#policies.values()) {
      if (!policy.headersReceived) continue;
      const next = await this.#runPolicy(policy.id, () => policy.headersReceived!(current, session));
      if (!next) continue;
      result = { ...result, ...next, responseHeaders: next.responseHeaders ?? result.responseHeaders };
      if (result.cancel) break;
      if (result.responseHeaders) current = { ...current, responseHeaders: Object.fromEntries(Object.entries(result.responseHeaders).map(([name, value]) => [name, Array.isArray(value) ? value : [value]])) };
    }
    return result;
  }
}
