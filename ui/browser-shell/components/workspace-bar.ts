import type { Tab, Workspace } from "../contracts.js";
import { button, element } from "../dom.js";

export interface WorkspaceBarActions {
  readonly onSelect: (workspaceId: string) => void;
  readonly onAdd: () => void;
}

export class WorkspaceBar {
  readonly element = element("div", "moon-workspaces");

  constructor(readonly actions: WorkspaceBarActions) {}

  render(workspaces: readonly Workspace[], tabs: readonly Tab[], activeWorkspaceId: string): void {
    this.element.replaceChildren(element("span", "moon-workspaces-label", "WORKSPACES"));
    for (const workspace of workspaces) {
      const count = tabs.filter(tab => (tab.workspaceId ?? "research") === workspace.id).length;
      const item = button(
        `moon-workspace-chip${workspace.id === activeWorkspaceId ? " is-active" : ""}`,
        `Abrir ${workspace.name}`
      );
      item.append(element("span", "", workspace.name), element("span", "moon-workspace-count", String(count)));
      item.addEventListener("click", () => this.actions.onSelect(workspace.id));
      this.element.append(item);
    }
    const add = button("moon-workspace-add", "Criar workspace", "plus");
    add.addEventListener("click", () => this.actions.onAdd());
    this.element.append(add);
  }
}
