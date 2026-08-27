import type { Capability } from "./capability.js";
export type PermissionSubjectType="moon"|"origin"|"extension"|"plugin";
export interface Permission{readonly id:string;readonly subjectType:PermissionSubjectType;readonly subjectId:string;readonly capability:Capability;readonly decision:"allow"|"deny"|"ask";readonly scope?:string;readonly createdAt:number;readonly updatedAt:number;readonly expiresAt?:number;}
