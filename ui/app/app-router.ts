export interface AppRoute {
  readonly path: string;
  readonly title: string;
  readonly render: (container: HTMLElement) => void | Promise<void>;
}

export class AppRouter {
  readonly #routes = new Map<string, AppRoute>();

  constructor(readonly outlet: HTMLElement) {}

  register(route: AppRoute): () => void {
    if (this.#routes.has(route.path)) throw new Error(`Route already registered: ${route.path}`);
    this.#routes.set(route.path, route);
    return () => this.#routes.delete(route.path);
  }

  async navigate(path: string, updateHistory = true): Promise<void> {
    const route = this.#routes.get(path) ?? this.#routes.get("/404");
    if (!route) throw new Error(`Route not found: ${path}`);
    this.outlet.replaceChildren();
    await route.render(this.outlet);
    document.title = `${route.title} — Moon`;
    if (updateHistory && location.protocol !== "file:" && location.pathname !== path) {
      history.pushState({ path }, "", path);
    }
  }

  start(): void {
    window.addEventListener("popstate", () => void this.navigate(location.pathname, false));
    const initialPath = location.protocol === "file:" ? "/" : location.pathname;
    void this.navigate(initialPath, false);
  }
}
