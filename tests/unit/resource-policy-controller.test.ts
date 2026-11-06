import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { ResourcePolicyController } from "../../apps/desktop/electron/services/resource-policy-controller.js";
import { DEFAULT_RESOURCE_SETTINGS } from "../../packages/ipc/resource-policy-contract.js";
const {showMessageBox} = vi.hoisted(() => ({showMessageBox: vi.fn()}));
vi.mock("electron", () => ({dialog: {showMessageBox}}));
afterEach(() => vi.resetAllMocks());
function fixture() {
  const settings = {...DEFAULT_RESOURCE_SETTINGS, reloadSafeOrigins: ["https://example.com"]};
  const store = {loadResourceSettings: vi.fn(async () => settings), saveResourceSettings: vi.fn(async () => undefined)};
  const host = new EventEmitter(); let locked = false; let privateWindow = false; let lock!: () => void;
  const candidate = {id: "tab", title: "Private title", url: "https://example.com/read", eligible: true, suspended: false, reasons: [], activity: {documentId: "1-2-3-4", url: "https://example.com/read", eligible: true, reasons: [], scrollX: 0, scrollY: 10}};
  const lifecycle = {browser: {windowIds: () => ["window"], onTabUpdated: () => () => undefined}, inspect: vi.fn(async () => [candidate]), suspend: vi.fn(async (_window: string, _candidate: unknown, assert: () => void) => {assert();}), dispose: vi.fn()};
  const windows = {get: () => host, require: () => host, profileId: () => "profile", isPrivate: () => privateWindow, isGuest: () => false};
  const access = {onLock: (listener: () => void) => { lock = listener; return () => undefined; }, assertUnlocked: () => {if (locked) throw new Error("locked");}};
  const args = [lifecycle, {freshSnapshot: () => ({memoryKiB: 12345})}, windows, {openedStorage: () => store}, access] as unknown as ConstructorParameters<typeof ResourcePolicyController>;
  const controller = new ResourcePolicyController(...args);
  return {controller, store, lifecycle, settings, private: () => {privateWindow = true;}, lock: () => {locked = true; lock();}};
}
it("requires main-process native review before enabling automation and persists only after approval", async () => {
  const f = fixture(); showMessageBox.mockResolvedValueOnce({response: 0});
  expect((await f.controller.configure("window", {...f.settings, automatic: true})).settings.automatic).toBe(false);
  expect(f.store.saveResourceSettings).not.toHaveBeenCalled();
  showMessageBox.mockResolvedValueOnce({response: 1}); await f.controller.configure("window", {...f.settings, automatic: true});
  expect(f.store.saveResourceSettings).toHaveBeenCalledOnce(); expect(showMessageBox.mock.calls[0]![1]).toMatchObject({defaultId: 0, cancelId: 0}); f.controller.stop();
});
it("never exposes internal document activity or full URLs through policy IPC state", async () => {
  const f = fixture(); const state = await f.controller.state("window", true);
  expect(state.candidates[0]!.url).toBe("https://example.com"); expect(JSON.stringify(state)).not.toContain("documentId"); f.controller.stop();
});
it("cancels manual economy without destroying any surface and reports real observations", async () => {
  const f = fixture(); showMessageBox.mockResolvedValueOnce({response: 0});
  expect(await f.controller.economize("window")).toMatchObject({cancelled: true, suspendedIds: [], beforeKiB: 12345, afterKiB: 12345}); expect(f.lifecycle.suspend).not.toHaveBeenCalled(); f.controller.stop();
});
it("rechecks access after native review and refuses work after locking", async () => {
  const f = fixture(); showMessageBox.mockImplementationOnce(async () => {f.lock(); return {response: 1};});
  await expect(f.controller.economize("window")).rejects.toThrow(); expect(f.lifecycle.suspend).not.toHaveBeenCalled(); f.controller.stop();
});
it("refuses suspension or policy mutation from private windows", async () => {
  const f = fixture(); f.private();
  await expect(f.controller.economize("window")).rejects.toThrow("privadas"); await expect(f.controller.configure("window", f.settings)).rejects.toThrow("normal"); expect(f.store.saveResourceSettings).not.toHaveBeenCalled(); f.controller.stop();
});
it("fails closed on invalid persisted policy instead of enabling defaults silently", async () => {
  const f = fixture(); f.store.loadResourceSettings.mockRejectedValueOnce(new Error("invalid"));
  expect(await f.controller.state("window")).toMatchObject({settings: {automatic: false, reloadSafeOrigins: []}, warning: expect.any(String)}); f.controller.stop();
});
