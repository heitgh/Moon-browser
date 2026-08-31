// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomizationStore } from "../../ui/customization/customization-store.js";
import { ONBOARDING_STORAGE_KEY, OnboardingFlow, readOnboardingState, shouldShowOnboarding } from "../../ui/onboarding/onboarding-flow.js";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  get length(): number { return this.#values.size; }
  clear(): void { this.#values.clear(); }
  getItem(key: string): string | null { return this.#values.get(key) ?? null; }
  key(index: number): string | null { return [...this.#values.keys()][index] ?? null; }
  removeItem(key: string): void { this.#values.delete(key); }
  setItem(key: string, value: string): void { this.#values.set(key, value); }
}

const flush = async (): Promise<void> => { await new Promise(resolve => setTimeout(resolve, 0)); };

describe("OnboardingFlow", () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it("rejects corrupt state and shows only for new or in-progress profiles", () => {
    const storage = new MemoryStorage(); storage.setItem(ONBOARDING_STORAGE_KEY, "{broken");
    expect(readOnboardingState(storage)).toBeNull(); expect(shouldShowOnboarding(storage)).toBe(true);
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ status: "completed", step: 5, choices: {} }));
    expect(shouldShowOnboarding(storage)).toBe(false);
  });

  it("resumes saved choices and cancels the whole visual draft when skipped", async () => {
    const storage = new MemoryStorage(); const store = CustomizationStore.load(storage);
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ status: "in-progress", step: 1, choices: { appearanceMode: "light", tabPosition: "left" } }));
    const close = vi.fn(); const flow = new OnboardingFlow({ store, storage, onDiscoverImportSources: async () => [], onImportBrowserProfile: vi.fn(), onImportBookmarksHtml: async () => null, onClose: close }); document.body.append(flow.element);
    expect(document.querySelector("h1")?.textContent).toBe("Escolha onde suas abas vivem"); expect(store.config.appearance.mode).toBe("light"); expect(store.config.layout.tabs.position).toBe("left");
    (document.querySelector('[aria-label="Direita"]') as HTMLButtonElement).click();
    (document.querySelector('[aria-label="Pular configuração inicial"]') as HTMLButtonElement).click(); await flush();
    expect(store.config.appearance.mode).toBe("dark"); expect(store.config.layout.tabs.position).toBe("top"); expect(readOnboardingState(storage)?.status).toBe("skipped"); expect(close).toHaveBeenCalledWith(false);
  });

  it("imports only checked categories and persists completion after all six steps", async () => {
    const storage = new MemoryStorage(); const store = CustomizationStore.load(storage);
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ status: "in-progress", step: 2, choices: {} }));
    const run = vi.fn(async () => ({ sourceId: "source-12345678", imported: { bookmarks: 2, history: 0 }, skipped: { bookmarks: 0, history: 0 } })); const close = vi.fn();
    const flow = new OnboardingFlow({ store, storage, onDiscoverImportSources: async () => [{ id: "source-12345678", browser: "chromium", name: "Chromium — Default", modifiedAt: 1, categories: { bookmarks: 2, history: 3 } }], onImportBrowserProfile: run, onImportBookmarksHtml: async () => null, onClose: close }); document.body.append(flow.element);
    (document.querySelector('[aria-label="Detectar navegadores instalados"]') as HTMLButtonElement).click(); await flush();
    const checkboxes = document.querySelectorAll<HTMLInputElement>(".moon-onboarding-import-source input"); checkboxes[1]!.checked = false;
    (document.querySelector('[aria-label="Importar seleção de Chromium — Default"]') as HTMLButtonElement).click(); await flush();
    expect(run).toHaveBeenCalledWith("source-12345678", ["bookmarks"]);
    for (let index = 0; index < 3; index += 1) { (document.querySelector('[aria-label="Agora não / Continuar"], [aria-label="Continuar"]') as HTMLButtonElement).click(); }
    expect(document.querySelector("h1")?.textContent).toBe("Seu Moon está pronto para navegar");
    (document.querySelector('[aria-label="Começar a navegar"]') as HTMLButtonElement).click(); await flush();
    expect(readOnboardingState(storage)?.status).toBe("completed"); expect(close).toHaveBeenCalledWith(true); expect(flow.element.isConnected).toBe(false);
  });
});
