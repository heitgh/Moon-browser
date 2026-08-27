import type { TimelineEventType } from "./timeline-event.js";
export interface TimelineQuery{readonly types?:readonly TimelineEventType[];readonly from?:number;readonly to?:number;readonly tabId?:string;readonly workspaceId?:string;readonly sessionId?:string;readonly limit?:number;}
