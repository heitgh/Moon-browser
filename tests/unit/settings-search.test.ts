import { describe, expect, it } from "vitest";
import { searchSettings } from "../../ui/customization/settings-catalog.js";

describe("Moon Settings intent search", () => {
  it.each([["grossura da sidebar", "sidebar-width"], ["sumir workspace", "workspace-visibility"], ["imagem de fundo", "wallpaper"], ["ícone do site", "favicons"], ["abrir configurações em aba", "settings-page"]])("maps %s to %s", (query, id) => { expect(searchSettings(query)[0]?.id).toBe(id); });
  it("ignores accents and supports English synonyms", () => { expect(searchSettings("simbolo do site")[0]?.id).toBe("favicons"); expect(searchSettings("sidebar width")[0]?.id).toBe("sidebar-width"); });
});
