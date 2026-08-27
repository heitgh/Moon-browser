import type { TabModel } from "../models/tab-model.js";

export type WorkspaceRuleMatch = "domain" | "url-prefix" | "url-pattern" | "title-pattern";
export interface WorkspaceRule {
  readonly id: string;
  readonly workspaceId: string;
  readonly match: WorkspaceRuleMatch;
  readonly value: string;
  readonly enabled: boolean;
  readonly priority: number;
}

export function matchesWorkspaceRule(rule: WorkspaceRule, tab: Pick<TabModel, "url" | "title">): boolean {
  if (!rule.enabled) return false;
  if (rule.match === "domain") { try { return new URL(tab.url).hostname === rule.value; } catch { return false; } }
  if (rule.match === "url-prefix") return tab.url.startsWith(rule.value);
  try {
    const pattern = new RegExp(rule.value, "i");
    return pattern.test(rule.match === "title-pattern" ? tab.title : tab.url);
  } catch { return false; }
}
