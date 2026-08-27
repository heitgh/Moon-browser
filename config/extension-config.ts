import type { ExtensionPermission } from "@moon/platform";
export interface ExtensionConfiguration{readonly enabled:boolean;readonly developerMode:boolean;readonly allowUnpacked:boolean;readonly autoUpdate:boolean;readonly blockedPermissions:ReadonlySet<ExtensionPermission>;readonly maximumEnabled:number;}
export const DEFAULT_EXTENSION_CONFIG:ExtensionConfiguration={enabled:false,developerMode:false,allowUnpacked:false,autoUpdate:false,blockedPermissions:new Set(["webRequestBlocking","management"]),maximumEnabled:50};
