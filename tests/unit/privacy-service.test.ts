import { expect, it, vi } from "vitest";
vi.mock("electron", () => ({session: {fromPartition: vi.fn()}}));
import { session } from "electron";
import { PrivacyService, blocksNetworkCookies } from "../../apps/desktop/electron/services/privacy-service.js";
import { SessionRequestPipeline, type SessionRequestPolicy } from "../../apps/desktop/electron/security/session-request-pipeline.js";
import { DEFAULT_PRIVACY_SETTINGS, parsePrivacySettings } from "../../packages/ipc/privacy-contract.js";

const thirdParty = {...DEFAULT_PRIVACY_SETTINGS, networkCookies: "block-third-party" as const};
const frame = (url: string) => ({top: {url}}) as unknown as Electron.WebFrameMain;
const request = (url: string, top: string) => ({url, resourceType: "xhr", frame: frame(top)});
it("classifies schemeful sites, private suffixes, missing context and exact exceptions", () => {
  expect(blocksNetworkCookies(thirdParty, request("https://cdn.example.co.uk/", "https://shop.example.co.uk/"))).toBe(false);
  expect(blocksNetworkCookies(thirdParty, request("https://user-a.github.io/", "https://user-b.github.io/"))).toBe(true);
  expect(blocksNetworkCookies(thirdParty, request("http://cdn.example.co.uk/", "https://shop.example.co.uk/"))).toBe(true);
  expect(blocksNetworkCookies(thirdParty, {url: "https://third.test/", resourceType: "xhr"})).toBe(true);
  expect(blocksNetworkCookies(thirdParty, {url: "https://third.test/", resourceType: "mainFrame"})).toBe(false);
  const excepted = {...thirdParty, cookieExceptions: ["https://shop.example.co.uk"]};
  expect(blocksNetworkCookies(excepted, request("https://third.test/", "https://shop.example.co.uk/"))).toBe(false);
  expect(blocksNetworkCookies(excepted, request("https://third.test/", "https://other.example.co.uk/"))).toBe(true);
});
it("strips network cookie headers for only the owning profile and keeps unrelated headers", async () => {
  const pipeline = new SessionRequestPipeline();
  const register = vi.spyOn(pipeline, "register");
  const service = new PrivacyService(pipeline);
  const filter = register.mock.calls[0]![0] as SessionRequestPolicy;
  const a = {} as Electron.Session;
  const b = {} as Electron.Session;
  service.registerSession(a, "a", true);
  service.registerSession(b, "b", true);
  service.hydrate("a", {...thirdParty, trackerExceptions: ["https://first.test"]});
  const data = request("https://third.test/", "https://first.test/");
  expect(filter.beforeSendHeaders!({...data, requestHeaders: {Cookie: "secret", Accept: "*/*"}} as never, a)).toEqual({requestHeaders: {Accept: "*/*"}});
  expect(filter.beforeSendHeaders!({...data, requestHeaders: {Cookie: "secret"}} as never, b)).toBeUndefined();
  expect(await filter.headersReceived!({...data, responseHeaders: {"set-cookie": ["secret"], "Content-Type": ["text/html"]}} as never, a)).toEqual({responseHeaders: {"Content-Type": ["text/html"]}});
  expect(service.blocksTrackers(a, data)).toBe(false);
  expect(service.blocksTrackers(b, data)).toBe(true);
});
it("clears only the selected site and known persistent partitions of the requesting profile", async () => {
  const service = new PrivacyService(new SessionRequestPipeline());
  const clearData = vi.fn(async () => undefined);
  const known = {clearData} as unknown as Electron.Session;
  const privateClear = vi.fn();
  service.registerSession(known, "a", true);
  service.registerSession({clearData: privateClear} as unknown as Electron.Session, "a", false);
  vi.mocked(session.fromPartition).mockReturnValue(known);
  await service.clearSiteData("a", "https://one.test", ["work"], () => undefined);
  expect(session.fromPartition).toHaveBeenCalledWith("persist:profile:a:default");
  expect(session.fromPartition).toHaveBeenCalledWith("persist:profile:a:workspace:work");
  expect(clearData).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({origins: ["https://one.test"]}));
  expect(privateClear).not.toHaveBeenCalled();
});
it("canonicalizes configuration and rejects paths, wildcards and invalid modes", () => {
  expect(parsePrivacySettings({...thirdParty, cookieExceptions: ["https://Example.test/"]}).cookieExceptions).toEqual(["https://example.test"]);
  for (const item of ["https://example.test/path", "https://*.test", "file:///tmp/data", "https://user:password@example.test"]) {
    expect(() => parsePrivacySettings({...thirdParty, cookieExceptions: [item]})).toThrow();
  }
  expect(() => parsePrivacySettings({...thirdParty, networkCookies: "script-blocker"})).toThrow();
});
