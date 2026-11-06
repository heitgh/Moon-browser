import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
const {showMessageBox} = vi.hoisted(() => ({showMessageBox: vi.fn()}));
vi.mock("electron", () => ({dialog: {showMessageBox}}));
import { NativeConsent } from "../../apps/desktop/electron/security/native-consent.js";

it("rejects overlapping native prompts and aborts approval when the profile locks", async () => {
  const service = new NativeConsent();
  const window = Object.assign(new EventEmitter(), {isDestroyed: () => false}) as unknown as Electron.BrowserWindow;
  const prompt = {title: "Confirmar", message: "Revisar", accept: "Continuar"};
  let finish!: () => void;
  showMessageBox.mockImplementationOnce(() => new Promise(resolve => {finish = () => resolve({response: 1});}));
  const confirm = service.confirm(window, "profile", prompt, () => undefined);
  await expect(service.confirm(window, "profile", prompt, () => undefined)).rejects.toThrow("aberta");
  service.cancelProfile("profile");
  expect(showMessageBox.mock.calls[0]![1]).toMatchObject({defaultId: 0, cancelId: 0, signal: {aborted: true}});
  finish();
  await expect(confirm).resolves.toBe(false);
  service.stop();
  await expect(service.confirm(window, "profile", prompt, () => undefined)).rejects.toThrow("encerrando");
});
