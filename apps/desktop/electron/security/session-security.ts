import type { Session } from "electron";
import type { SessionRequestPipeline } from "./session-request-pipeline.js";
export function hardenSession(session: Session, pipeline: SessionRequestPipeline): void { session.setPermissionCheckHandler((_contents, permission) => ["clipboard-sanitized-write", "fullscreen"].includes(permission)); pipeline.attach(session); }
