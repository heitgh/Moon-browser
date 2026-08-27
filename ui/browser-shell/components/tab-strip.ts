import type { Tab } from "../contracts.js";
import { button, element, icon } from "../dom.js";

export interface TabStripActions {
  readonly onActivate: (tabId: string) => void;
  readonly onClose: (tabId: string) => void;
}

export class TabStrip {
  readonly element = element("div", "moon-tabs-list");

  constructor(readonly actions: TabStripActions) {}

  render(tabs: readonly Tab[], activeTabId: string | undefined, favicons: ReadonlyMap<string, string> = new Map()): void {
    this.element.replaceChildren();
    for (const tab of tabs) {
      const label = tab.title || "Nova aba";
      const tabButton = button(`moon-tab${tab.id === activeTabId ? " is-active" : ""}`, label);
      const favicon = element("span", `moon-tab-favicon${tab.loading ? " is-loading" : ""}`);
      const faviconData = favicons.get(tab.id);
      if (faviconData) { const image = document.createElement("img"); image.src = faviconData; image.alt = ""; image.draggable = false; favicon.append(image); }
      else favicon.append(icon(tab.url === "moon://newtab" ? "moon" : "globe"));

      const close = button("moon-tab-close", `Fechar ${tab.title || "aba"}`, "close");
      close.addEventListener("click", event => {
        event.stopPropagation();
        this.actions.onClose(tab.id);
      });
      tabButton.append(favicon, element("span", "moon-tab-title", label), close);
      tabButton.addEventListener("click", () => this.actions.onActivate(tab.id));
      this.element.append(tabButton);
    }
  }
}
