import { builtinSiteIcon } from "../site-icons.js";
import type { Tab } from "../contracts.js";
import { button, element, icon } from "../dom.js";

export interface TabStripActions {
  readonly onActivate: (tabId: string) => void;
  readonly onClose: (tabId: string) => void;
}

export class TabStrip {
  readonly element = element("div", "moon-tabs-list");

  #activeTabId: string | undefined;

  constructor(readonly actions: TabStripActions) {
    this.element.addEventListener("wheel", event => {
      const strip = this.element;
      if (event.ctrlKey || event.metaKey || event.deltaX || !event.deltaY ||
          strip.scrollHeight > strip.clientHeight || strip.scrollWidth <= strip.clientWidth) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
      strip.scrollLeft += event.deltaY * unit;
      event.preventDefault();
    }, { passive: false });
  }

  render(tabs: readonly Tab[], activeTabId: string | undefined, favicons: ReadonlyMap<string, string> = new Map()): void {
    const { scrollLeft, scrollTop } = this.element;
    const trailingButton = this.element.querySelector(".moon-add-tab");
    const children: Element[] = [];
    let activeButton: HTMLElement | undefined;
    for (const tab of tabs) {
      const label = `${tab.title || "Nova aba"}${tab.suspended ? " · suspensa" : ""}`;
      const tabButton = button(`moon-tab${tab.id === activeTabId ? " is-active" : ""}`, label);
      const favicon = element("span", `moon-tab-favicon${tab.loading ? " is-loading" : ""}`);
      const faviconData = builtinSiteIcon(tab.url) ?? favicons.get(tab.id);
      if (faviconData) { const image = document.createElement("img"); image.src = faviconData; image.alt = ""; image.draggable = false; image.addEventListener("error", () => favicon.replaceChildren(icon("globe")), { once: true }); favicon.append(image); }
      else favicon.append(icon(tab.url === "moon://newtab" ? "moon" : "globe"));

      const close = button("moon-tab-close", `Fechar ${tab.title || "aba"}`, "close");
      close.addEventListener("click", event => {
        event.stopPropagation();
        this.actions.onClose(tab.id);
      });
      tabButton.append(favicon, element("span", "moon-tab-title", label), close);
      tabButton.addEventListener("click", () => this.actions.onActivate(tab.id));
      children.push(tabButton);
      if (tab.id === activeTabId) activeButton = tabButton;
    }
    if (trailingButton) children.push(trailingButton);
    this.element.replaceChildren(...children);
    this.element.scrollLeft = scrollLeft;
    this.element.scrollTop = scrollTop;
    if (activeButton && this.#activeTabId !== activeTabId) {
      const target = activeButton.nextElementSibling === trailingButton && trailingButton ? trailingButton : activeButton;
      const viewport = this.element.getBoundingClientRect();
      const bounds = target.getBoundingClientRect();
      if (bounds.left < viewport.left) this.element.scrollLeft += bounds.left - viewport.left;
      if (bounds.right > viewport.right) this.element.scrollLeft += bounds.right - viewport.right;
      if (bounds.top < viewport.top) this.element.scrollTop += bounds.top - viewport.top;
      if (bounds.bottom > viewport.bottom) this.element.scrollTop += bounds.bottom - viewport.bottom;
    }
    this.#activeTabId = activeTabId;
  }
}
