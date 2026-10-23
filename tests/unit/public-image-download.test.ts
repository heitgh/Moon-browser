import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { fetchPublicImage, isPublicAddress, resolvePublicImage } from "../../apps/desktop/electron/security/public-image-download.js";
const types = new Set(["image/png"]);
function response(status: number, headers: object, chunks = [Buffer.from("image")]) {
  return Object.assign(Readable.from(chunks), { statusCode: status, headers });
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mocks.request.mockImplementation((_url, _options, done) => {
    const req = new EventEmitter(); Object.assign(req, { end: () => done(response(200, { "content-type": "image/png" })) }); return req;
  });
});
describe("image SSRF protection", () => {
  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fd00::1", "::ffff:7f00:1", "::ffff:a00:1", "64:ff9b::a00:1", "2002:7f00:1::"])("blocks %s", address => expect(isPublicAddress(address)).toBe(false));
  it.each(["http://example.com", "file:///tmp/x", "https://user:pass@example.com", "https://example.com:8443", "https://127.1", "https://[::1]"])("rejects %s before connecting", async url => {
    await expect(resolvePublicImage(new URL(url))).rejects.toThrow(); expect(mocks.request).not.toHaveBeenCalled();
  });
  it("rejects mixed public/private DNS answers", async () => {
    mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(fetchPublicImage("https://image.test/x", types, 100, 1000, 2)).rejects.toThrow(); expect(mocks.request).not.toHaveBeenCalled();
  });
  it("pins the validated address so a second DNS answer cannot rebind it", async () => {
    mocks.lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]).mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(fetchPublicImage("https://image.test/x", types, 100, 1000, 2)).resolves.toMatch(/^data:image\/png;base64,/);
    const [url, options] = mocks.request.mock.calls[0]!; const callback = vi.fn(); options.lookup("image.test", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4); expect(mocks.lookup).toHaveBeenCalledTimes(1);
    expect(url.hostname).toBe("image.test"); expect(options.agent).toBe(false);
  });
  it("rejects a redirect to an internal destination before the second connection", async () => {
    mocks.request.mockImplementationOnce((_url, _options, done) => Object.assign(new EventEmitter(), { end: () => done(response(302, { location: "https://169.254.169.254/metadata" })) }));
    await expect(fetchPublicImage("https://image.test", types, 100, 1000, 2)).rejects.toThrow(); expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("revalidates DNS for each redirect", async () => {
    mocks.request.mockImplementationOnce((_url, _options, done) => Object.assign(new EventEmitter(), { end: () => done(response(302, { location: "/next" })) }));
    mocks.lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]).mockResolvedValueOnce([{ address: "192.168.0.1", family: 4 }]);
    await expect(fetchPublicImage("https://image.test", types, 100, 1000, 2)).rejects.toThrow(); expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it.each([
    response(200, { "content-type": "text/html" }),
    response(200, { "content-type": "image/png", "content-length": "200" }),
    response(200, { "content-type": "image/png" }, [Buffer.alloc(101)]),
    response(302, { location: "/again" })
  ])("rejects invalid MIME, size and redirect limit", async result => {
    mocks.request.mockImplementationOnce((_url, _options, done) => Object.assign(new EventEmitter(), { end: () => done(result) }));
    await expect(fetchPublicImage("https://image.test", types, 100, 1000, 0)).rejects.toThrow();
    expect(result.destroyed).toBe(true);
  });
});
