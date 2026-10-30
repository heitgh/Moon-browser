// Nexus Inc. — main-process access checks must reject untrusted callers.
import { afterEach, expect, it, vi } from "vitest";
import type { IpcMainInvokeEvent } from "electron";
import type { WindowManager } from "../../apps/desktop/electron/main/window-manager.js";
import type { ProfileAccessService } from "../../apps/desktop/electron/services/profile-access.js";
const native = vi.hoisted(() => ({handle: vi.fn(), on: vi.fn(), once: vi.fn(), powerOn: vi.fn()}));
vi.mock("electron", () => ({app: {on: native.on, once: native.once, getAppPath: () => "/moon"},
  ipcMain: {handle: native.handle}, powerMonitor: {on: native.powerOn}, BrowserWindow: vi.fn(), dialog: {}}));
import { ProfileAccessController, ProfileAccessError } from "../../apps/desktop/electron/security/profile-access-controller.js";
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.clearAllMocks(); });
function fixture() {
  vi.useFakeTimers();
  const service = {protectedProfileIds: vi.fn(async () => ["default"]), beginLock: vi.fn(() => false), unlock: vi.fn(), load: vi.fn(async () => undefined), assertUnlocked: vi.fn(), status: vi.fn(() => ({enabled: true, locked: false, lockOnSystem: true}))};
  const windows = {idForWebContents: vi.fn(() => "shell"), profileId: () => "default", list: () => []};
  const controller = new ProfileAccessController(service as unknown as ProfileAccessService, windows as unknown as WindowManager, () => undefined, async () => undefined);
  return {service, windows, controller};
}
it("never sends a password from a caller outside the dedicated gate to the verifier", async () => {
  const {service} = fixture();
  const invoke = native.handle.mock.lastCall![1];
  await expect(invoke({sender: {isDestroyed: () => false}}, "password")).rejects.toThrow(/inválida/);
  expect(service.unlock).not.toHaveBeenCalled();
});
it("checks the source profile for every ordinary shell operation", () => {
  const {service, controller, windows} = fixture();
  const event = {sender: {isDestroyed: () => false}} as unknown as IpcMainInvokeEvent;
  controller.authorizeShell(event, "profile:read");
  expect(service.assertUnlocked).toHaveBeenCalledWith("default");
  service.assertUnlocked.mockImplementation(() => { throw new Error("locked"); });
  expect(() => controller.authorizeShell(event, "profile:read")).toThrow("locked");
  windows.idForWebContents.mockReturnValueOnce("");
  expect(() => controller.authorizeShell(event, "profile:read")).toThrow(/indisponível/);
});
it("labels invalid access metadata separately so it cannot enter database recovery", async () => {
  const {service, controller} = fixture();
  service.load.mockRejectedValueOnce(new Error("invalid protection"));
  await expect(controller.authorizeStorage("default")).rejects.toBeInstanceOf(ProfileAccessError);
  expect(service.assertUnlocked).not.toHaveBeenCalled();
});
it("allows storage only after its access policy has approved loading", async () => {
  const {service, controller} = fixture();
  await controller.authorizeStorage("default");
  expect(service.load).toHaveBeenCalledWith("default");
  expect(service.assertUnlocked).toHaveBeenCalledWith("default");
});

it("retries a system lock request after a credential operation finishes", () => {
  const {controller, windows} = fixture();
  vi.spyOn(windows, "list").mockReturnValue([{webContents: {}}] as never);
  const locking = vi.spyOn(controller, "lock").mockReturnValueOnce(false).mockReturnValue(true);
  native.powerOn.mock.calls.find(call => call[0] === "lock-screen")![1]();
  expect(locking).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(5000);
  expect(locking).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(5000);
  expect(locking).toHaveBeenCalledTimes(2);
});

it("does not create a new access gate during application shutdown", () => {
  const {service, controller} = fixture();
  native.on.mock.calls.find(call => call[0] === "before-quit")![1]();
  expect(controller.lock("default")).toBe(false);
  expect(service.beginLock).not.toHaveBeenCalled();
});

it("authorizes every protected profile before whole-directory recovery", async () => {
  const {service, controller} = fixture();
  service.protectedProfileIds.mockResolvedValueOnce(["default", "secondary"]);
  await controller.authorizeRecovery();
  expect(service.assertUnlocked.mock.calls).toEqual([["default"], ["secondary"]]);
});
