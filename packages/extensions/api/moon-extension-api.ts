import type { ExtensionPermission } from "@moon/platform";
export interface ExtensionApiContext{readonly extensionId:string;readonly permissions:ReadonlySet<ExtensionPermission>;readonly signal?:AbortSignal;}
export function requireExtensionPermission(context:ExtensionApiContext,permission:ExtensionPermission):void{if(!context.permissions.has(permission))throw new Error(`Extension ${context.extensionId} lacks permission: ${permission}`);if(context.signal?.aborted)throw new DOMException("Extension operation aborted","AbortError");}
export interface MoonExtensionApi{readonly extensionId:string;readonly version:string;readonly capabilities:readonly string[];}
