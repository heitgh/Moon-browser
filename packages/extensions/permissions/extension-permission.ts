import type { ExtensionPermission } from "@moon/platform";
export interface ExtensionPermissionGrant{readonly extensionId:string;readonly permission:ExtensionPermission;readonly granted:boolean;readonly origin?:string;readonly decidedAt:number;readonly expiresAt?:number;}
