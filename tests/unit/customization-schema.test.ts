import { describe, expect, it } from "vitest";
import {
  CUSTOMIZATION_LAST_VALID_KEY,
  CUSTOMIZATION_STORAGE_KEY,
  createDefaultCustomization,
  migrateLegacyCustomization,
  parseCustomizationImport,
  resolveCustomization,
  serializeCustomization,
  validateCustomization
} from "../../ui/customization/customization-schema.js";
import { CustomizationStore } from "../../ui/customization/customization-store.js";
import { migrateCustomizationV2ToV3 } from "../../ui/customization/customization-v3-migration.js";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();
  get length(): number { return this.#values.size; }
  clear(): void { this.#values.clear(); }
  getItem(key: string): string | null { return this.#values.get(key) ?? null; }
  key(index: number): string | null { return [...this.#values.keys()][index] ?? null; }
  removeItem(key: string): void { this.#values.delete(key); }
  setItem(key: string, value: string): void { this.#values.set(key, value); }
}

class FailingStorage extends MemoryStorage {
  failWrites = false;
  override setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException(`Falha ao gravar ${key}`, "QuotaExceededError");
    super.setItem(key, value);
  }
}

describe("CustomizationSchemaV4", () => {
  it("creates a complete, valid and versioned default", () => {
    const document = validateCustomization(createDefaultCustomization(123));
    expect(document.version).toBe(4);
    expect(document.global.appearance.colors).toMatchObject({ background: "#0a0c11", accent: "#8a5cf5", danger: "#f43f5e" });
    expect(document.global.layout.toolbar.items).toHaveLength(12);
    expect(document.global.home.widgets).toHaveLength(15);
    expect(document.global.search.providers.map(provider => provider.id)).toContain("bing");
  });

  it("migrates every active V1 preference without losing it", () => {
    const storage = new MemoryStorage();
    storage.setItem("moon:preferences:v1", JSON.stringify({ accent: "#38bdf8", wallpaper: "./assets/wallpapers/eclipse.svg", searchEngine: "google", showClock: false, showShortcuts: false, glassHome: true }));
    const migrated = migrateLegacyCustomization(storage, 100);
    expect(migrated.global.appearance.colors.accent).toBe("#38bdf8");
    expect(migrated.global.appearance.wallpaper.source).toContain("eclipse.svg");
    expect(migrated.global.search.defaultEngine).toBe("google");
    expect(migrated.global.home.cardStyle).toBe("glass");
    expect(migrated.global.home.widgets.find(widget => widget.id === "clock")?.visible).toBe(false);
  });

  it("rejects unreadable colors and insecure search templates", () => {
    const document = createDefaultCustomization();
    const unreadable = structuredClone(document); (unreadable.global.appearance.colors as { text: string }).text = unreadable.global.appearance.colors.background;
    expect(() => validateCustomization(unreadable)).toThrow(/contraste/i);
    const insecure = structuredClone(document); (insecure.global.search.providers[0] as { template: string }).template = "http://search.test/?q={query}";
    expect(() => validateCustomization(insecure)).toThrow(/HTTPS/i);
  });

  it("accepts only bounded local GIF data for animated wallpapers", () => {
    const document = createDefaultCustomization(); const animated = structuredClone(document);
    const wallpaper = animated.global.appearance.wallpaper as { type: string; source: string; fallbackData?: string };
    wallpaper.type = "animated";
    wallpaper.source = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    wallpaper.fallbackData = "data:image/webp;base64,YQ==";
    expect(validateCustomization(animated).global.appearance.wallpaper).toMatchObject({ type: "animated", fallbackData: "data:image/webp;base64,YQ==" });
    wallpaper.source = "data:image/webp;base64,UklGRlBJRgAAAFdFQlA="; (wallpaper as { animate?: boolean }).animate = false;
    expect(validateCustomization(animated).global.appearance.wallpaper).toMatchObject({ type: "animated", animate: false });
    (animated.global.appearance.wallpaper as { source: string }).source = "https://example.test/track.gif";
    expect(() => validateCustomization(animated)).toThrow(/animado/i);
    wallpaper.source = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    wallpaper.fallbackData = "data:image/gif;base64,YQ==";
    expect(() => validateCustomization(animated)).toThrow(/fallback estático/i);
  });

  it("migrates the legacy all-settings experience to the progressive Personalizar level", () => {
    const legacy = structuredClone(createDefaultCustomization());
    (legacy.experience as { mode: string }).mode = "all";
    expect(validateCustomization(legacy).experience).toMatchObject({ mode: "advanced", view: "all" });
  });

  it("hydrates the safe top-tab default for documents created before tab positioning", () => {
    const legacy = structuredClone(createDefaultCustomization());
    delete (legacy.global.layout as { tabs?: typeof legacy.global.layout.tabs }).tabs;
    const migrated = validateCustomization(legacy);
    expect(migrated.global.layout.tabs).toEqual({ position: "top", width: 240, newTabButton: "after-tabs" });
  });

  it("round-trips all, appearance and workspace exports", () => {
    const current = createDefaultCustomization(100);
    for (const scope of ["all", "appearance", "workspace"] as const) {
      const serialized = serializeCustomization(current, scope, "research");
      const imported = parseCustomizationImport(serialized, createDefaultCustomization(200), "research");
      expect(imported.version).toBe(4);
      expect(resolveCustomization(imported, "research").appearance.colors.accent).toBe("#8a5cf5");
    }
  });
});

describe("CustomizationSchemaV3 migration", () => {
  it("adds only safe V3 defaults while preserving every V2 value", () => {
    const source = createDefaultCustomization(321); (source.global.layout.sidebar as { width: number }).width = 144;
    const migrated = migrateCustomizationV2ToV3(source);
    expect(migrated.version).toBe(3); expect(migrated.global.layout.sidebar.width).toBe(144);
    expect(migrated.global.layout.sidebar).toMatchObject({ autoHide: false, hideDelay: 600 });
    expect(migrated.global.workspaceDisplay.visibility).toBe("always"); expect(migrated.global.favicons.ttlDays).toBe(30);
  });
});

describe("CustomizationStore", () => {
  it("migrates the V2 key without deleting or mutating its original value", () => {
    const storage = new MemoryStorage(); const legacy = { ...createDefaultCustomization(77), version: 2 }; delete (legacy as Partial<typeof legacy>).experience;
    const original = JSON.stringify(legacy); storage.setItem("moon:customization:v2", original); const store = CustomizationStore.load(storage);
    expect(store.document.version).toBe(4); expect(store.document.updatedAt).toBe(77); expect(storage.getItem("moon:customization:v2")).toBe(original); expect(storage.getItem(CUSTOMIZATION_STORAGE_KEY)).not.toBeNull();
  });
  it("recovers the last valid document when the primary value is corrupt", () => {
    const storage = new MemoryStorage(); const valid = createDefaultCustomization(42);
    storage.setItem(CUSTOMIZATION_STORAGE_KEY, "{broken"); storage.setItem(CUSTOMIZATION_LAST_VALID_KEY, JSON.stringify(valid));
    const store = CustomizationStore.load(storage);
    expect(store.loadResult.recovered).toBe(true); expect(store.document.updatedAt).toBe(42);
  });

  it("recovers only an invalid section and preserves other recent preferences", () => {
    const storage = new MemoryStorage(); const backup = createDefaultCustomization(42); const recent = structuredClone(backup);
    (recent.global.appearance.colors as { accent: string }).accent = "not-a-color";
    (recent.global.layout.sidebar as { width: number }).width = 104;
    (recent.global.typography as { family: string }).family = "Georgia, serif";
    storage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(recent)); storage.setItem(CUSTOMIZATION_LAST_VALID_KEY, JSON.stringify(backup));
    const store = CustomizationStore.load(storage);
    expect(store.loadResult.recovered).toBe(true); expect(store.loadResult.message).toContain("global.appearance");
    expect(store.config.appearance.colors.accent).toBe(backup.global.appearance.colors.accent);
    expect(store.config.layout.sidebar.width).toBe(104); expect(store.config.typography.family).toBe("Georgia, serif");
  });

  it("applies live changes with undo, redo and preview cancellation", () => {
    const storage = new MemoryStorage(); const store = CustomizationStore.load(storage); const original = store.config.appearance.colors.accent; const confirmed = storage.getItem(CUSTOMIZATION_STORAGE_KEY);
    store.beginPreview(); expect(store.set("appearance.colors.accent", "#38bdf8")).toBe(true); expect(store.config.appearance.colors.accent).toBe("#38bdf8");
    expect(storage.getItem(CUSTOMIZATION_STORAGE_KEY)).toBe(confirmed);
    expect(store.undo()).toBe(true); expect(store.config.appearance.colors.accent).toBe(original);
    expect(store.redo()).toBe(true); expect(store.config.appearance.colors.accent).toBe("#38bdf8");
    store.cancelPreview(); expect(store.config.appearance.colors.accent).toBe(original); expect(storage.getItem(CUSTOMIZATION_STORAGE_KEY)).toBe(confirmed);
  });

  it("persists a preview only after apply", async () => {
    const storage = new MemoryStorage(); const store = CustomizationStore.load(storage); store.beginPreview();
    expect(store.set("appearance.colors.accent", "#38bdf8")).toBe(true);
    expect(JSON.parse(storage.getItem(CUSTOMIZATION_STORAGE_KEY)!).global.appearance.colors.accent).not.toBe("#38bdf8");
    expect(await store.applyPreview()).toBe(true);
    expect(JSON.parse(storage.getItem(CUSTOMIZATION_STORAGE_KEY)!).global.appearance.colors.accent).toBe("#38bdf8");
  });

  it("sends exactly one canonical commit for a complete preview", async () => {
    const storage = new MemoryStorage(); const commits: unknown[] = [];
    const store = CustomizationStore.load(storage, async document => { commits.push(document); return document; });
    store.beginPreview(); store.set("appearance.colors.accent", "#38bdf8"); store.set("layout.uiScale", 1.1);
    expect(commits).toHaveLength(0);
    expect(await store.applyPreview()).toBe(true);
    expect(commits).toHaveLength(1);
  });

  it("keeps the draft open and local mirror unchanged when the canonical commit fails", async () => {
    const storage = new MemoryStorage(); const store = CustomizationStore.load(storage, async () => { throw new Error("SQLite indisponível"); });
    const confirmed = storage.getItem(CUSTOMIZATION_STORAGE_KEY);
    store.beginPreview(); store.set("appearance.colors.accent", "#38bdf8");
    expect(await store.applyPreview()).toBe(false);
    expect(store.previewing).toBe(true); expect(store.lastError).toContain("SQLite indisponível");
    expect(storage.getItem(CUSTOMIZATION_STORAGE_KEY)).toBe(confirmed);
  });

  it("keeps the confirmed state and the preview open when saving fails", async () => {
    const storage = new FailingStorage(); const store = CustomizationStore.load(storage); const confirmed = storage.getItem(CUSTOMIZATION_STORAGE_KEY);
    store.beginPreview(); expect(store.set("appearance.colors.accent", "#38bdf8")).toBe(true); storage.failWrites = true;
    expect(await store.applyPreview()).toBe(false); expect(store.previewing).toBe(true); expect(storage.getItem(CUSTOMIZATION_STORAGE_KEY)).toBe(confirmed);
    expect(store.lastError).toMatch(/Falha ao gravar/);
  });

  it("offers a reversible safe mode and a diagnostic without browsing data", () => {
    const storage = new MemoryStorage(); const store = CustomizationStore.load(storage); store.beginPreview();
    expect(store.startSafeMode()).toBe(true); expect(store.config.appearance.wallpaper.type).toBe("color"); expect(store.config.appearance.motion.enabled).toBe(false); expect(store.config.layout.sidebar.position).toBe("left");
    const diagnostic = store.diagnostic(); expect(diagnostic).toContain("moon-settings-diagnostic"); expect(diagnostic).not.toContain("http");
    store.cancelPreview(); expect(store.config.appearance.wallpaper.type).toBe("local");
  });

  it("applies an animated V2 Moon Theme without downgrading it to a static wallpaper", () => {
    const store = CustomizationStore.load(new MemoryStorage()); store.beginPreview();
    expect(store.applyMoonTheme({ wallpaper: { asset: "assets/wallpaper.gif", kind: "animated" } }, "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "data:image/webp;base64,YQ==")).toBe(true);
    expect(store.config.appearance.wallpaper.type).toBe("animated");
    expect(store.config.appearance.wallpaper.fallbackData).toBe("data:image/webp;base64,YQ==");
  });

  it("persists sanitized semantic icon overrides and rejects active SVG content", () => {
    const safe = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8"/></svg>').toString("base64")}`;
    const document = createDefaultCustomization(); (document.global.icons.overrides as { home?: string }).home = safe;
    expect(validateCustomization(document).global.icons.overrides.home).toBe(safe);
    const unsafe = structuredClone(document); (unsafe.global.icons.overrides as { home?: string }).home = `data:image/svg+xml;base64,${Buffer.from('<svg><script>alert(1)</script></svg>').toString("base64")}`;
    expect(() => validateCustomization(unsafe)).toThrow(/conteúdo ativo/i);
  });

  it("versions saved themes, keeps rollback history and survives a restart", async () => {
    const storage = new MemoryStorage(); const store = CustomizationStore.load(storage); store.beginPreview();
    const saved = store.saveTheme({ name: "Produto", description: "Tema da equipe", includes: ["colors", "icons", "home"] });
    expect(saved).toMatchObject({ version: 1, favorite: false, includes: ["colors", "icons", "home"] });
    store.updateTheme(saved.id, { name: "Produto V2", description: "Atualizado", includes: ["colors", "icons", "home"] });
    expect(store.document.themes[0]).toMatchObject({ version: 2, history: [{ version: 1 }] });
    store.restoreThemeRevision(saved.id); expect(store.document.themes[0]).toMatchObject({ version: 3, history: [] });
    expect(await store.applyPreview()).toBe(true);
    const restored = CustomizationStore.load(storage); expect(restored.document.themes[0]).toMatchObject({ name: "Produto V2", version: 3, description: "Atualizado" });
  });

  it("keeps workspace customization independent from global values", () => {
    const store = CustomizationStore.load(new MemoryStorage()); store.setWorkspace("research"); store.setScope("workspace");
    expect(store.set("layout.sidebar.position", "right")).toBe(true); expect(store.config.layout.sidebar.position).toBe("right");
    store.setWorkspace("study"); expect(store.config.layout.sidebar.position).toBe("left");
    store.setWorkspace("research"); expect(store.config.layout.sidebar.position).toBe("right");
  });

  it("rejects invalid updates without corrupting the persisted state", () => {
    const storage = new MemoryStorage(); const store = CustomizationStore.load(storage); const before = storage.getItem(CUSTOMIZATION_STORAGE_KEY);
    expect(store.set("appearance.colors.text", "javascript:bad")).toBe(false);
    expect(storage.getItem(CUSTOMIZATION_STORAGE_KEY)).toBe(before);
    expect(store.lastError).toMatch(/HEX/i);
  });
});
