export type OmniboxActionType = "navigate" | "search" | "command" | "tab" | "history" | "bookmark" | "setting";
export interface OmniboxAction { readonly id: string; readonly type: OmniboxActionType; readonly title: string; readonly subtitle?: string; readonly icon?: string; readonly score: number; execute(): void | Promise<void>; }
export function rankOmniboxActions(actions: readonly OmniboxAction[]): readonly OmniboxAction[] { return [...actions].sort((a,b) => b.score-a.score || a.title.localeCompare(b.title)); }
