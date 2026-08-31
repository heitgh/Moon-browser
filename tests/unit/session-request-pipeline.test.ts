import { describe, expect, it, vi } from "vitest";
import { SessionRequestPipeline } from "../../apps/desktop/electron/security/session-request-pipeline.js";

describe("SessionRequestPipeline", () => {
  it("installs one listener per stage and composes policies in order", async () => {
    let before: ((details: Electron.OnBeforeRequestListenerDetails, callback: (response: Electron.CallbackResponse) => void) => void) | undefined;
    let headers: ((details: Electron.OnHeadersReceivedListenerDetails, callback: (response: Electron.HeadersReceivedResponse) => void) => void) | undefined;
    const webRequest = { onBeforeRequest: vi.fn((_filter, listener) => { before = listener; }), onHeadersReceived: vi.fn((_filter, listener) => { headers = listener; }) };
    const session = { webRequest } as never;
    const pipeline = new SessionRequestPipeline();
    const order: string[] = [];
    pipeline.register({ id: "first", beforeRequest: () => { order.push("first"); return {}; }, headersReceived: details => ({ responseHeaders: { ...details.responseHeaders, "X-Moon-First": ["1"] } }) });
    pipeline.register({ id: "second", beforeRequest: () => { order.push("second"); return { cancel: true }; }, headersReceived: details => ({ responseHeaders: { ...details.responseHeaders, "X-Moon-Second": ["2"] } }) });
    pipeline.attach(session); pipeline.attach(session);
    expect(webRequest.onBeforeRequest).toHaveBeenCalledOnce(); expect(webRequest.onHeadersReceived).toHaveBeenCalledOnce();
    const beforeResponse = await new Promise<Electron.CallbackResponse>(resolve => before!({ url: "https://moon.test/" } as never, resolve));
    expect(beforeResponse.cancel).toBe(true); expect(order).toEqual(["first", "second"]);
    const headersResponse = await new Promise<Electron.HeadersReceivedResponse>(resolve => headers!({ url: "https://moon.test/", responseHeaders: {} } as never, resolve));
    expect(headersResponse.responseHeaders).toMatchObject({ "X-Moon-First": ["1"], "X-Moon-Second": ["2"] });
  });

  it("fails open when a policy throws", async () => {
    let before: ((details: Electron.OnBeforeRequestListenerDetails, callback: (response: Electron.CallbackResponse) => void) => void) | undefined;
    const session = { webRequest: { onBeforeRequest: (_filter: unknown, listener: typeof before) => { before = listener; }, onHeadersReceived: vi.fn() } } as never;
    const pipeline = new SessionRequestPipeline(); pipeline.register({ id: "broken", beforeRequest: () => { throw new Error("broken policy"); } }); pipeline.attach(session);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await new Promise(resolve => before!({} as never, resolve))).toEqual({}); spy.mockRestore();
  });
});
