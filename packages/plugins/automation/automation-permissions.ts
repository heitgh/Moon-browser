export type AutomationPermission="tabs.read"|"tabs.write"|"navigation"|"storage"|"notifications"|"network"|"ai";
export interface AutomationPermissionGrant{readonly pluginId:string;readonly automationId:string;readonly permissions:ReadonlySet<AutomationPermission>;}
export function requireAutomationPermission(grant:AutomationPermissionGrant,permission:AutomationPermission):void{if(!grant.permissions.has(permission))throw new Error(`Automation ${grant.automationId} lacks permission: ${permission}`);}
