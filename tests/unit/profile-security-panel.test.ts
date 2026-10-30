// @vitest-environment happy-dom
// Nexus Inc. — profile access controls and password field lifecycle.
import { afterEach, expect, it, vi } from "vitest";
import { ProfileSecurityPanel } from "../../ui/security/profile-security-panel.js";
import type { MoonBrowserBridge } from "../../ui/browser-shell/contracts.js";

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
afterEach(() => document.body.replaceChildren());
async function fixture(enabled = false) {
  const bridge = {
    getProfileAccess: vi.fn(async () => ({enabled, locked: false, idleMinutes: 5, lockOnSystem: false, supportsSystemLock: false, retryAfterMs: 0})),
    enableProfileAccess: vi.fn(async () => false), changeProfilePassword: vi.fn(async () => undefined),
    disableProfileAccess: vi.fn(async () => undefined), configureProfileAccess: vi.fn(async () => undefined), lockProfile: vi.fn(async () => undefined)
  };
  const panel = new ProfileSecurityPanel(bridge as unknown as MoonBrowserBridge);
  document.body.append(panel.element); await settle();
  const buttons = () => [...panel.element.querySelectorAll("button")];
  const click = async (name: string) => { buttons().find(button => button.textContent === name)!.click(); await settle(); };
  const inputs = () => [...panel.element.querySelectorAll<HTMLInputElement>('input[type="password"]')];
  return {bridge, panel, click, inputs};
}
it("requires matching passwords and keeps mismatches out of IPC", async () => {
  const {bridge, panel, click, inputs} = await fixture();
  inputs()[0].value = "first-password"; inputs()[1].value = "other-password";
  await click("Ativar proteção");
  expect(bridge.enableProfileAccess).not.toHaveBeenCalled();
  expect(panel.element.querySelector('[role="status"]')?.textContent).toContain("não coincidem");
  expect(inputs().every(input => input.value === "")).toBe(true);
});
it("shows native cancellation and clears all password fields", async () => {
  const {bridge, panel, click, inputs} = await fixture();
  inputs().forEach(input => { input.value = "secure-password"; });
  await click("Ativar proteção");
  expect(bridge.enableProfileAccess).toHaveBeenCalledWith("secure-password");
  expect(panel.element.querySelector('[role="status"]')?.textContent).toBe("Operação cancelada.");
  expect(inputs().every(input => input.value === "")).toBe(true);
});
it("passes the current password for automatic locking and explains unavailable OS locking", async () => {
  const {bridge, panel, click, inputs} = await fixture(true);
  inputs()[0].value = "current-password";
  expect(panel.element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled).toBe(true);
  expect(panel.element.textContent).toContain("indisponível aqui");
  const select = panel.element.querySelector("select")!; select.value = "15";
  await click("Salvar bloqueio automático");
  expect(bridge.configureProfileAccess).toHaveBeenCalledWith("current-password", 15, false);
  expect(inputs().every(input => input.value === "")).toBe(true);
});
it("reports failures without leaving the current password in the interface", async () => {
  const {bridge, panel, click, inputs} = await fixture(true);
  bridge.disableProfileAccess.mockRejectedValueOnce(new Error("Senha atual incorreta."));
  inputs()[0].value = "wrong-password"; await click("Desativar proteção");
  expect(panel.element.querySelector('[role="status"]')?.textContent).toBe("Senha atual incorreta.");
  expect(inputs().every(input => input.value === "")).toBe(true);
});
