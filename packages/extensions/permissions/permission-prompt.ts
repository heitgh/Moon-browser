import type { ExtensionPermissionRequest,ExtensionPermissionResult } from "@moon/platform";
export interface PermissionPrompt{show(request:ExtensionPermissionRequest,details:{extensionName:string;risk:"low"|"medium"|"high"}):Promise<ExtensionPermissionResult>;}
export function permissionRisk(permission:ExtensionPermissionRequest["permission"]):"low"|"medium"|"high"{if(["webRequestBlocking","cookies","management","clipboardRead"].includes(permission))return"high";if(["history","bookmarks","downloads","scripting"].includes(permission))return"medium";return"low";}
