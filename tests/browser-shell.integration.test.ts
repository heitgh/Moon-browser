// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const tab = { id: "tab-1", url: "moon://newtab", title: "Nova guia", active: true, loading: false, workspaceId: "research", private: false };
const createTab = vi.fn(async (_url?: string, workspaceId?: string) => ({ ...tab, id: `tab-${createTab.mock.calls.length + 1}`, workspaceId: workspaceId ?? "research" }));
const navigate = vi.fn(async () => undefined);
const showInternalPage = vi.fn(async () => undefined);
const setContentVisible = vi.fn(async () => undefined);
const downloadListeners: Array<(downloads: readonly unknown[]) => void> = [];
const adblockListeners: Array<(status: unknown) => void> = [];
const tabUpdateListeners: Array<(update: unknown) => void> = [];
const permissionListeners: Array<(request: { readonly id: string; readonly origin: string; readonly permission: string }) => void> = [];
const profileData = { bookmarks: [] as Array<{ id: string; title: string; url: string; time: number }>, history: [] as Array<{ id: string; title: string; url: string; time: number }>, notes: "", workspaces: [{ id: "research", name: "Pesquisa", position: 0 }, { id: "study", name: "Estudos", position: 1 }, { id: "projects", name: "Projetos", position: 2 }] };
let sitePermissions: Array<{ origin: string; permission: string; decision: "allow" | "deny"; updatedAt: number }> = [];
let localProfiles = [{ id: "default", name: "Padrão", avatar: "moon", color: "#8b5cf6", kind: "persistent", default: true, createdAt: 1, lastUsedAt: 1 }];
const mutateProfileData = vi.fn(async (mutation: { type: string; id?: string; content?: string; value?: { id: string; title?: string; url?: string; time?: number; name?: string; position?: number } }) => {
  if (mutation.type === "bookmark:save" && mutation.value) profileData.bookmarks.unshift(mutation.value as typeof profileData.bookmarks[number]);
  if (mutation.type === "bookmark:delete") profileData.bookmarks = profileData.bookmarks.filter(item => item.id !== mutation.id);
  if (mutation.type === "history:record" && mutation.value) profileData.history.unshift(mutation.value as typeof profileData.history[number]);
  if (mutation.type === "history:clear") profileData.history = [];
  if (mutation.type === "notes:save") profileData.notes = mutation.content ?? "";
  if (mutation.type === "workspace:save" && mutation.value) profileData.workspaces.push(mutation.value as typeof profileData.workspaces[number]);
  if (mutation.type === "workspace:delete") profileData.workspaces = profileData.workspaces.filter(item => item.id !== mutation.id);
});
const bridge = {
  createTab, getWindowContext: vi.fn(async () => ({ private: false, guest: false, profileId: "default" })), createPrivateWindow: vi.fn(async () => undefined), getTabs: vi.fn(async () => []), closeTab: vi.fn(async () => undefined), activateTab: vi.fn(async () => undefined), showHome: vi.fn(async () => undefined), showInternalPage, navigate,
  back: vi.fn(async () => undefined), forward: vi.fn(async () => undefined), reload: vi.fn(async () => undefined), stop: vi.fn(async () => undefined), setBounds: vi.fn(async () => undefined), setContentVisible, respondToPermission: vi.fn(async () => undefined), listSitePermissions: vi.fn(async () => sitePermissions), clearSitePermission: vi.fn(async (origin: string, permission: string) => { sitePermissions = sitePermissions.filter(item => item.origin !== origin || item.permission !== permission); }),
  getDownloads: vi.fn(async () => []), pauseDownload: vi.fn(async () => undefined), resumeDownload: vi.fn(async () => undefined), cancelDownload: vi.fn(async () => undefined), openDownload: vi.fn(async () => undefined), showDownloadInFolder: vi.fn(async () => undefined), clearFinishedDownloads: vi.fn(async () => undefined),
  getAdblockStatus: vi.fn(async () => ({ phase: "active", enabled: true, blockedCount: 12 })), setAdblockEnabled: vi.fn(async (enabled: boolean) => ({ phase: enabled ? "active" : "disabled", enabled, blockedCount: 12 })),
  exportProductData: vi.fn(async (_content: string) => true), importProductData: vi.fn(async () => null),
  exportCustomization: vi.fn(async (_content: string) => true), importCustomization: vi.fn(async () => null), fetchWallpaper: vi.fn(async () => "data:image/png;base64,YQ=="),
  exportMoonHome: vi.fn(async (_content: string) => true), importMoonHome: vi.fn(async () => null),
  exportSettingsDiagnostic: vi.fn(async (_content: string) => true),
  fetchFavicon: vi.fn(async () => "data:image/png;base64,YQ=="),
  migrateLegacyProfile: vi.fn(async () => ({ migrated: true, version: 1 })), loadCustomization: vi.fn(async (legacy: unknown) => legacy), commitCustomization: vi.fn(async (document: unknown) => document), getProfileData: vi.fn(async () => profileData), mutateProfileData, onTabUpdated: vi.fn((listener: (update: unknown) => void) => { tabUpdateListeners.push(listener); return () => undefined; }), onTabClosed: vi.fn(() => () => undefined),
  listLocalProfiles: vi.fn(async () => localProfiles),
  createLocalProfile: vi.fn(async (profile: { name: string; avatar: string; color: string }) => { const created = { id: "profile-product", ...profile, kind: "persistent", default: false, createdAt: 2, lastUsedAt: 2 }; localProfiles = [...localProfiles, created]; return created; }), updateLocalProfile: vi.fn(async (profile: unknown) => profile), openLocalProfile: vi.fn(async () => undefined), createGuestProfile: vi.fn(async () => undefined), getLocalProfileDeletionSummary: vi.fn(async () => undefined), deleteLocalProfile: vi.fn(async () => undefined),
  discoverImportSources: vi.fn(async () => [{ id: "source-12345678", browser: "chromium", name: "Chromium — Default", modifiedAt: Date.now(), categories: { bookmarks: 3, history: 5 } }]),
  importBrowserProfile: vi.fn(async (selection: { sourceId: string; categories: readonly string[] }) => ({ sourceId: selection.sourceId, imported: { bookmarks: selection.categories.includes("bookmarks") ? 3 : 0, history: selection.categories.includes("history") ? 5 : 0 }, skipped: { bookmarks: 0, history: 0 } })),
  importBookmarksHtml: vi.fn(async () => null),
  onDownloadsUpdated: vi.fn((listener: (downloads: readonly unknown[]) => void) => { downloadListeners.push(listener); return () => undefined; }),
  onAdblockStatus: vi.fn((listener: (status: unknown) => void) => { adblockListeners.push(listener); return () => undefined; }),
  onPermissionRequested: vi.fn((listener: (request: { readonly id: string; readonly origin: string; readonly permission: string }) => void) => { permissionListeners.push(listener); return () => undefined; })
};
const flush = async (): Promise<void> => { await new Promise(resolve => setTimeout(resolve, 0)); await new Promise(resolve => setTimeout(resolve, 0)); };

beforeAll(async () => {
  document.body.innerHTML = '<div id="moon-root"></div>';
  localStorage.setItem("moon:onboarding:v1", JSON.stringify({ status: "completed", step: 5, choices: {} }));
  Object.defineProperty(window, "moonBrowser", { value: bridge, configurable: true });
  await import("../ui/browser-shell.js");
  await flush();
});
beforeEach(() => { navigate.mockClear(); setContentVisible.mockClear(); });

describe("Moon browser shell", () => {
  it("renders every primary product control", () => {
    for (const label of ["Página inicial", "Central de comandos", "Gerenciar perfis", "Workspaces", "Favoritos", "Downloads", "Histórico", "Traduzir página", "Bloco de notas", "Configurações"]) {
      expect(document.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
    }
    expect(document.querySelector('[aria-label="Moon AI"]')).toBeNull(); expect(document.querySelector('[aria-label="Extensões"]')).toBeNull();
    expect((document.querySelector('[aria-label="Abrir Moon AI"]') as HTMLButtonElement).hidden).toBe(true);
    expect((document.querySelector('[aria-label="Abrir módulos pela toolbar"]') as HTMLButtonElement).hidden).toBe(true);
  });
  it("shows the active profile and creates a real isolated profile from the manager", async () => {
    (document.querySelector('[aria-label="Gerenciar perfis"]') as HTMLButtonElement).click(); await flush();
    expect(document.querySelector(".moon-profile-card.is-active")?.textContent).toContain("Padrão");
    const form = [...document.querySelectorAll<HTMLFormElement>(".moon-profile-form")].find(candidate => !candidate.hidden)!;
    (form.querySelector('input[type="text"], input:not([type])') as HTMLInputElement).value = "Produto";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await flush();
    expect(bridge.createLocalProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "Produto" }));
    expect(document.querySelector(".moon-profile-list")?.textContent).toContain("Produto");
  });
  it("opens every sidebar module with its real content", () => {
    const modules = [
      ["Workspaces", "Workspaces"], ["Favoritos", "Favoritos"], ["Downloads", "Downloads"],
      ["Histórico", "Histórico"], ["Traduzir página", "Tradutor"], ["Bloco de notas", "Bloco de notas"], ["Foco e Zen", "Foco e Zen"],
      ["Proteção e AdBlock", "Proteção"]
    ] as const;
    for (const [control, heading] of modules) {
      (document.querySelector(`[aria-label="${control}"]`) as HTMLButtonElement).click();
      expect(document.querySelector(".moon-drawer.is-open .moon-drawer-title")?.textContent).toBe(heading);
      expect(document.querySelector(".moon-drawer.is-open .moon-drawer-body")?.childElementCount).toBeGreaterThan(0);
    }
  });
  it("persists notes entered through the SQLite profile bridge", async () => {
    mutateProfileData.mockClear();
    (document.querySelector('[aria-label="Bloco de notas"]') as HTMLButtonElement).click();
    const notes = document.querySelector(".moon-notes-input") as HTMLTextAreaElement;
    notes.value = "Decisão importante da startup"; notes.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300)); await flush();
    expect(mutateProfileData).toHaveBeenCalledWith({ type: "notes:save", content: "Decisão importante da startup" });
  });
  it("runs a reversible continuous Focus session through the real shell", async () => {
    (document.querySelector('[aria-label="Foco e Zen"]') as HTMLButtonElement).click();
    const preset = document.querySelector('[aria-label="Preset de foco"]') as HTMLSelectElement; preset.value = "writing"; preset.dispatchEvent(new Event("change", { bubbles: true }));
    (document.querySelector('[aria-label="Iniciar sessão de foco"]') as HTMLButtonElement).click(); await flush();
    expect(document.documentElement.dataset.zen).toBe("true"); expect((document.querySelector('[aria-label="Sair do modo Foco (Ctrl+Shift+Z)"]') as HTMLButtonElement).hidden).toBe(false); expect(document.querySelector(".moon-focus-countdown")?.textContent).toBe("CONTÍNUO");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true })); await flush();
    expect(document.documentElement.dataset.zen).toBeUndefined(); expect((document.querySelector('[aria-label="Sair do modo Foco (Ctrl+Shift+Z)"]') as HTMLButtonElement).hidden).toBe(true);
  });
  it("opens and closes settings while hiding native web content", async () => {
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull(); expect(setContentVisible).toHaveBeenCalledWith(false);
    expect(document.querySelector('[data-testid="customization-center"]')).not.toBeNull();
    (document.querySelector('[aria-label="Fechar e cancelar alterações"]') as HTMLButtonElement).click(); await flush();
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(setContentVisible).toHaveBeenLastCalledWith(true);
  });
  it("searches unified commands and opens the matching Settings section", async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", ctrlKey: true, shiftKey: true, bubbles: true })); await flush();
    const input = document.querySelector('[aria-label="Buscar na Central de comandos"]') as HTMLInputElement; expect(input).not.toBeNull(); input.value = "grossura sidebar"; input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector(".moon-command-result")?.textContent).toContain("Largura da sidebar"); (document.querySelector(".moon-command-result") as HTMLButtonElement).click(); await flush();
    expect(document.querySelector('[data-testid="customization-center"]')).not.toBeNull(); expect(document.querySelector(".moon-customization-content")?.textContent).toContain("Sidebar e drawers");
    (document.querySelector('[aria-label="Fechar e cancelar alterações"]') as HTMLButtonElement).click(); await flush();
  });
  it("does not reveal a native web surface over Home after closing the Command Center", async () => {
    setContentVisible.mockClear();
    (document.querySelector('[aria-label="Central de comandos"]') as HTMLButtonElement).click(); await flush();
    const input = document.querySelector('[aria-label="Buscar na Central de comandos"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await flush();
    expect(document.querySelector('[aria-label="Buscar na Central de comandos"]')).toBeNull();
    expect(setContentVisible).toHaveBeenLastCalledWith(false);
  });
  it("sends omnibox searches to the browser engine", async () => {
    const input = document.querySelector(".moon-omnibox") as HTMLInputElement; input.value = "arquitetura de navegadores";
    input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await flush();
    expect(navigate).toHaveBeenCalledWith(expect.any(String), "https://duckduckgo.com/?q=arquitetura%20de%20navegadores");
  });
  it("navigates the omnibox on Enter without duplicating form submission", async () => {
    const input = document.querySelector(".moon-omnibox") as HTMLInputElement;
    input.value = "https://example.com/";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await flush();
    expect(navigate).toHaveBeenCalledWith(expect.any(String), "https://example.com/");
  });
  it("renders live download updates instead of sample data", async () => {
    downloadListeners[0]?.([{ id: "download-1", url: "https://example.com/moon.zip", filename: "moon.zip", savePath: "/tmp/moon.zip", state: "in-progress", receivedBytes: 500, totalBytes: 1_000, speedBytesPerSecond: 100, percentage: 50, startedAt: Date.now() }]);
    (document.querySelector('[aria-label="Downloads"]') as HTMLButtonElement).click(); await flush();
    expect(document.querySelector(".moon-download-header")?.textContent).toContain("moon.zip");
    expect((document.querySelector(".moon-download-progress") as HTMLProgressElement).value).toBe(50);
  });
  it("creates named workspaces and opens a real isolated tab", async () => {
    (document.querySelector('[aria-label="Workspaces"]') as HTMLButtonElement).click();
    const name = document.querySelector('.moon-drawer input[placeholder="Nome do workspace"]') as HTMLInputElement;
    name.value = "Produto";
    name.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    expect(createTab.mock.calls.at(-1)?.[1]).toMatch(/^workspace-/);
    expect(document.querySelector(".moon-drawer")?.textContent).toContain("Produto");
  });
  it("favorites the active page through the SQLite profile bridge", async () => {
    mutateProfileData.mockClear();
    tabUpdateListeners[0]?.({ tab: { ...tab, id: createTab.mock.results[0]?.value ? "tab-2" : "tab-1", url: "https://moon.test/", title: "Moon Test", active: true, loading: false }, navigation: { canGoBack: false, canGoForward: false } });
    await flush();
    (document.querySelector('[aria-label="Adicionar aos favoritos"]') as HTMLButtonElement).click();
    await flush();
    expect(mutateProfileData).toHaveBeenCalledWith(expect.objectContaining({ type: "bookmark:save", value: expect.objectContaining({ url: "https://moon.test/" }) }));
  });
  it("loads a validated favicon through the native bridge and renders it in the tab", async () => {
    bridge.fetchFavicon.mockClear();
    tabUpdateListeners[0]?.({ tab: { ...tab, url: "https://moon.test/", title: "Moon Test", faviconUrl: "https://moon.test/favicon.png", active: true, loading: false }, navigation: { canGoBack: false, canGoForward: false } });
    await flush(); expect(bridge.fetchFavicon).toHaveBeenCalledWith("https://moon.test/favicon.png");
    expect((document.querySelector(".moon-tab-favicon img") as HTMLImageElement | null)?.src).toContain("data:image/png;base64");
    (document.querySelector('[aria-label="Favoritos"]') as HTMLButtonElement).click(); await flush();
    expect((document.querySelector(".moon-drawer .moon-site-mark img") as HTMLImageElement | null)?.src).toContain("data:image/png;base64");
  });
  it("does not rebuild the hidden Home for ordinary web-tab updates", async () => {
    const search = document.querySelector(".moon-home-search-input");
    tabUpdateListeners[0]?.({ tab: { ...tab, url: "https://moon.test/", title: "Moon Test", active: true, loading: false }, navigation: { canGoBack: false, canGoForward: false } }); await flush();
    tabUpdateListeners[0]?.({ tab: { ...tab, url: "https://moon.test/", title: "Moon Test atualizado", active: true, loading: false }, navigation: { canGoBack: false, canGoForward: false } }); await flush();
    expect(document.querySelector(".moon-home-search-input")).toBe(search);
    tabUpdateListeners[0]?.({ tab, navigation: { canGoBack: false, canGoForward: false } }); await flush();
  });
  it("toggles the real adblock service from the protection panel", async () => {
    bridge.setAdblockEnabled.mockClear();
    (document.querySelector('[aria-label="Proteção e AdBlock"]') as HTMLButtonElement).click();
    const toggle = document.querySelector(".moon-adblock-toggle") as HTMLButtonElement;
    toggle.click(); await flush();
    expect(bridge.setAdblockEnabled).toHaveBeenCalledWith(false);
  });
  it("exports validated V4 customization through the native bridge", async () => {
    bridge.exportCustomization.mockClear();
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[aria-label="Workspaces e dados"]') as HTMLButtonElement).click();
    (document.querySelector('[aria-label="Exportar tudo"]') as HTMLButtonElement).click(); await flush();
    expect(bridge.exportCustomization).toHaveBeenCalledOnce();
    expect(bridge.exportCustomization.mock.calls[0]?.[0]).toContain('"format": "moon-customization"');
    (document.querySelector('[aria-label="Fechar e cancelar alterações"]') as HTMLButtonElement).click(); await flush();
  });
  it("states honestly that cloud sync and the credential vault are unavailable", async () => {
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[data-mode="advanced"]') as HTMLButtonElement).click(); (document.querySelector('[aria-label="Workspaces e dados"]') as HTMLButtonElement).click(); await flush();
    expect(document.querySelector(".moon-customization-content")?.textContent).toContain("Sincronização em nuvem ainda não configurada");
    expect(document.querySelector(".moon-customization-content")?.textContent).toContain("Cofre indisponível nesta build");
    (document.querySelector('[aria-label="Fechar e cancelar alterações"]') as HTMLButtonElement).click(); await flush();
  });

  it("previews local browser profiles and imports only explicitly selected categories", async () => {
    bridge.discoverImportSources.mockClear(); bridge.importBrowserProfile.mockClear();
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[aria-label="Detectar perfis instalados"]') as HTMLButtonElement).click(); await flush();
    expect(bridge.discoverImportSources).toHaveBeenCalledOnce(); expect(document.querySelector(".moon-import-source")?.textContent).toContain("Chromium — Default");
    (document.querySelector('[aria-label="Importar de Chromium — Default"]') as HTMLButtonElement).click(); await flush();
    expect(bridge.importBrowserProfile).toHaveBeenCalledWith({ sourceId: "source-12345678", categories: ["bookmarks", "history"] });
    (document.querySelector('[aria-label="Fechar e cancelar alterações"]') as HTMLButtonElement).click(); await flush();
  });

  it("applies customization live without persisting the draft and cancels the preview", async () => {
    const before = document.documentElement.dataset.moonTheme;
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[data-mode="simple"]') as HTMLButtonElement).click(); await flush();
    const confirmed = localStorage.getItem("moon:customization:v4");
    (document.querySelector(`[aria-label="${before === "light" ? "Escuro" : "Claro"}"]`) as HTMLButtonElement).click(); await flush();
    expect(document.documentElement.dataset.moonTheme).not.toBe(before);
    expect(document.querySelector('.moon-settings-footer-copy strong[data-dirty="true"]')?.textContent).toContain("não aplicadas");
    expect(document.querySelector<HTMLElement>(".moon-preview-wallpaper")?.style.backgroundImage).not.toBe("");
    expect(document.querySelectorAll(".moon-preview-widget").length).toBeGreaterThan(0);
    expect(document.querySelector(".moon-preview-brand .moon-icon")).not.toBeNull();
    (document.querySelector('[aria-label="Recolher prévia"]') as HTMLButtonElement).click();
    expect((document.querySelector(".moon-live-preview") as HTMLElement).hidden).toBe(true);
    expect(localStorage.getItem("moon:customization:v4")).toBe(confirmed);
    (document.querySelector('[aria-label="Cancelar mudanças"]') as HTMLButtonElement).click(); await flush();
    expect(document.documentElement.dataset.moonTheme).toBe(before);
  });

  it("saves a versioned visual theme with a deterministic thumbnail and restores it after reopening", async () => {
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[data-mode="advanced"]') as HTMLButtonElement).click(); (document.querySelector('[aria-label="Aparência"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[aria-label="Novo tema"]') as HTMLButtonElement).click(); await flush();
    const form = document.querySelector<HTMLFormElement>(".moon-theme-save-form")!; const name = form.querySelector<HTMLInputElement>('[aria-label="Nome do tema"]')!; const description = form.querySelector<HTMLTextAreaElement>('[aria-label="Descrição do tema"]')!; name.value = "Moon Produto"; description.value = "Identidade persistente da startup"; form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await flush();
    const card = [...document.querySelectorAll<HTMLElement>(".moon-theme-card")].find(candidate => candidate.textContent?.includes("Moon Produto")); expect(card?.querySelector(".moon-theme-thumbnail")).not.toBeNull(); expect(card?.textContent).toContain("Home");
    (document.querySelector('[aria-label="Aplicar personalização"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush(); (document.querySelector('[data-mode="advanced"]') as HTMLButtonElement).click(); (document.querySelector('[aria-label="Aparência"]') as HTMLButtonElement).click(); await flush();
    expect([...document.querySelectorAll(".moon-theme-card")].some(candidate => candidate.textContent?.includes("Moon Produto"))).toBe(true);
    (document.querySelector('[aria-label="Fechar e cancelar alterações"]') as HTMLButtonElement).click(); await flush();
  });

  it("edits the real Home with keyboard controls and cancels the draft exactly", async () => {
    (document.querySelector('[aria-label="Editar Home"]') as HTMLButtonElement).click(); await flush();
    const before = [...document.querySelectorAll<HTMLElement>(".moon-home-widget")].map(widget => widget.dataset.widget);
    const first = document.querySelector<HTMLElement>(".moon-home-widget")!; const firstId = first.dataset.widget!; const beforeColumns = first.style.getPropertyValue("--moon-widget-columns");
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, shiftKey: true, bubbles: true })); await flush();
    expect(document.querySelector<HTMLElement>(`[data-widget="${firstId}"]`)?.style.getPropertyValue("--moon-widget-columns")).not.toBe(beforeColumns);
    const resize = document.querySelector<HTMLButtonElement>(".moon-home-widget-resize")!; const pointerWidget = resize.closest<HTMLElement>("[data-widget]")!; const pointerId = pointerWidget.dataset.widget!; const pointerBefore = pointerWidget.style.getPropertyValue("--moon-widget-columns"); const capture = new Set<number>();
    resize.setPointerCapture = id => { capture.add(id); }; resize.hasPointerCapture = id => capture.has(id); resize.releasePointerCapture = id => { capture.delete(id); };
    resize.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerId: 7, clientX: 80 })); resize.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 7, clientX: 20 })); resize.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, clientX: 20 })); await flush();
    expect(document.querySelector<HTMLElement>(`[data-widget="${pointerId}"]`)?.style.getPropertyValue("--moon-widget-columns")).not.toBe(pointerBefore);
    document.querySelector<HTMLElement>(`[data-widget="${firstId}"]`)!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true })); await flush();
    expect([...document.querySelectorAll<HTMLElement>(".moon-home-widget")].map(widget => widget.dataset.widget)).not.toEqual(before);
    const removable = document.querySelector<HTMLButtonElement>(".moon-home-widget-remove")!; const removedId = removable.closest<HTMLElement>("[data-widget]")!.dataset.widget;
    removable.click(); await flush(); expect(document.querySelector(`[data-widget="${removedId}"]`)).toBeNull();
    expect(document.querySelector(`[aria-label="Adicionar ${removedId}"]`)).not.toBeNull();
    bridge.exportMoonHome.mockClear(); (document.querySelector('[aria-label="Exportar arquivo .moonhome"]') as HTMLButtonElement).click(); await flush(); expect(bridge.exportMoonHome).toHaveBeenCalledOnce();
    (document.querySelector('[aria-label="Cancelar edição da Home"]') as HTMLButtonElement).click(); await flush();
    expect([...document.querySelectorAll<HTMLElement>(".moon-home-widget")].map(widget => widget.dataset.widget)).toEqual(before);
  });

  it("searches across settings categories and reorders toolbar controls by keyboard", async () => {
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    const search = document.querySelector('[aria-label="Buscar nas configurações"]') as HTMLInputElement;
    search.value = "tipografia"; search.dispatchEvent(new Event("input", { bubbles: true })); await flush();
    expect(document.querySelector(".moon-settings-result")?.textContent).toContain("Família e ritmo");
    (document.querySelector(".moon-settings-result") as HTMLButtonElement).click(); await flush();
    expect(document.querySelector(".moon-customization-content")?.textContent).toContain("Família e ritmo");
    (document.querySelector('[aria-label="Layout e densidade"]') as HTMLButtonElement).click(); await flush();
    const first = document.querySelector(".moon-order-row") as HTMLElement;
    const confirmed = localStorage.getItem("moon:customization:v4"); const firstLabel = first.querySelector("strong")?.textContent; const secondLabel = document.querySelectorAll(".moon-order-row")[1]?.querySelector("strong")?.textContent;
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true })); await flush();
    expect(document.querySelectorAll(".moon-order-row")[0]?.querySelector("strong")?.textContent).toBe(secondLabel); expect(document.querySelectorAll(".moon-order-row")[1]?.querySelector("strong")?.textContent).toBe(firstLabel);
    expect(localStorage.getItem("moon:customization:v4")).toBe(confirmed);
    expect(document.querySelector(".moon-visually-hidden")?.textContent).toContain("posição");
    (document.querySelector('[aria-label="Cancelar mudanças"]') as HTMLButtonElement).click(); await flush();
  });
  it("opens settings as an internal full page and restores Home on close", async () => {
    showInternalPage.mockClear(); bridge.showHome.mockClear();
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[aria-label="Abrir configurações em página completa"]') as HTMLButtonElement).click(); await flush();
    expect(showInternalPage).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/^moon:\/\/settings\//));
    expect(document.querySelector('[data-testid="customization-center"]')?.getAttribute("data-presentation")).toBe("page");
    tabUpdateListeners[0]?.({ tab: { ...tab, url: "moon://settings/appearance", title: "Configurações", active: true }, navigation: { canGoBack: true, canGoForward: false } }); await flush();
    (document.querySelector('[aria-label="Voltar à página inicial"]') as HTMLButtonElement).click(); await flush();
    expect(bridge.showHome).toHaveBeenCalled();
    tabUpdateListeners[0]?.({ tab: { ...tab, url: "moon://newtab", title: "Nova guia", active: true }, navigation: { canGoBack: true, canGoForward: false } }); await flush();
    expect(document.querySelector('[data-testid="customization-center"]')).toBeNull();
  });
  it("applies workspace visibility live and keeps keyboard recovery available", async () => {
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[data-mode="simple"]') as HTMLButtonElement).click(); await flush();
    const workspaceGroup = [...document.querySelectorAll<HTMLElement>(".moon-setting-group")].find(group => group.querySelector("h3")?.textContent === "Workspaces")!;
    const visibility = workspaceGroup.querySelector("select") as HTMLSelectElement; visibility.value = "hidden"; visibility.dispatchEvent(new Event("change", { bubbles: true })); await flush();
    expect(document.documentElement.dataset.moonWorkspaces).toBe("hidden");
    (document.querySelector('[aria-label="Cancelar mudanças"]') as HTMLButtonElement).click(); await flush();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", ctrlKey: true, shiftKey: true })); await flush();
    expect(document.querySelector(".moon-drawer.is-open .moon-drawer-title")?.textContent).toBe("Workspaces");
    (document.querySelector('[aria-label="Fechar painel"]') as HTMLButtonElement).click(); await flush();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: ",", ctrlKey: true })); await flush();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    (document.querySelector('[aria-label="Fechar e cancelar alterações"]') as HTMLButtonElement).click(); await flush();
    bridge.createPrivateWindow.mockClear(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true, shiftKey: true })); await flush();
    expect(bridge.createPrivateWindow).toHaveBeenCalledOnce();
  });
  it("switches between top and functional vertical tabs through Settings", async () => {
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[data-mode="simple"]') as HTMLButtonElement).click(); await flush();
    const tabsGroup = [...document.querySelectorAll<HTMLElement>(".moon-setting-group")].find(group => group.querySelector("h3")?.textContent === "Abas")!;
    const selects = [...tabsGroup.querySelectorAll<HTMLSelectElement>("select")]; const position = selects[0]!; const newTabPosition = selects[1];
    expect(newTabPosition?.closest("label")?.textContent).toContain("Posição do botão +");
    position.value = "left"; position.dispatchEvent(new Event("change", { bubbles: true })); await flush();
    expect(document.documentElement.dataset.moonTabs).toBe("left");
    expect(document.documentElement.style.getPropertyValue("--moon-tabs-width")).toBe("240px");
    expect(document.querySelector('[aria-label^="Usar wallpaper"]')).not.toBeNull();
    (document.querySelector('[aria-label="Cancelar mudanças"]') as HTMLButtonElement).click(); await flush();
    expect(document.documentElement.dataset.moonTabs).toBe("top");
  });
  it("moves or hides the new-tab button while Ctrl+T remains available", async () => {
    (document.querySelector('[aria-label="Configurações"]') as HTMLButtonElement).click(); await flush();
    (document.querySelector('[data-mode="advanced"]') as HTMLButtonElement).click(); (document.querySelector('[aria-label="Layout e densidade"]') as HTMLButtonElement).click(); await flush();
    const group = [...document.querySelectorAll<HTMLElement>(".moon-setting-group")].find(item => item.querySelector("h3")?.textContent === "Posição das abas")!;
    const position = [...group.querySelectorAll<HTMLSelectElement>("select")].find(select => select.closest("label")?.textContent?.includes("Botão de nova aba"))!;
    position.value = "toolbar"; position.dispatchEvent(new Event("change", { bubbles: true })); await flush();
    expect(document.querySelector(".moon-toolbar-v2 > .moon-add-tab")).not.toBeNull();
    position.value = "hidden"; position.dispatchEvent(new Event("change", { bubbles: true })); await flush(); expect(document.querySelector(".moon-add-tab")).toBeNull();
    createTab.mockClear(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", ctrlKey: true })); await flush(); expect(createTab).toHaveBeenCalledOnce();
    (document.querySelector('[aria-label="Cancelar mudanças"]') as HTMLButtonElement).click(); await flush(); expect(document.querySelector(".moon-tabs-bar > .moon-add-tab")).not.toBeNull();
  });
  it("queues site permissions and sends an explicit user decision", async () => {
    bridge.respondToPermission.mockClear(); setContentVisible.mockClear();
    permissionListeners[0]?.({ id: "permission-1", origin: "https://meet.example", permission: "media" });
    permissionListeners[0]?.({ id: "permission-2", origin: "https://maps.example", permission: "geolocation" });
    await flush();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("meet.example");
    (document.querySelector('[aria-label="Negar permissão"]') as HTMLButtonElement).click(); await flush();
    expect(bridge.respondToPermission).toHaveBeenCalledWith("permission-1", false);
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("maps.example");
    sitePermissions = [{ origin: "https://maps.example", permission: "geolocation", decision: "allow", updatedAt: Date.now() }];
    (document.querySelector('[aria-label="Permitir acesso"]') as HTMLButtonElement).click(); await flush();
    expect(bridge.respondToPermission).toHaveBeenCalledWith("permission-2", true);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(setContentVisible).toHaveBeenLastCalledWith(true);
    (document.querySelector('[aria-label="Proteção e AdBlock"]') as HTMLButtonElement).click(); await flush();
    expect(document.querySelector(".moon-drawer")?.textContent).toContain("maps.example");
    (document.querySelector('[aria-label^="Esquecer geolocation"]') as HTMLButtonElement).click(); await flush();
    expect(bridge.clearSitePermission).toHaveBeenCalledWith("https://maps.example", "geolocation");
  });
});
