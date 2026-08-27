import type { Session } from "electron";
import type { PermissionDecision, SecurityPermission } from "@moon/platform";
export type PermissionResolver = (origin: string, permission: SecurityPermission) => Promise<PermissionDecision>;
export function installPermissionHandler(session: Session, resolve: PermissionResolver): void { session.setPermissionRequestHandler((webContents, permission, callback) => { const origin = new URL(webContents.getURL()).origin; void resolve(origin, permission as SecurityPermission).then(decision => callback(decision === "allow"), () => callback(false)); }); }
