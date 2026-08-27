export type ProcessIsolationMode="site"|"origin"|"workspace"|"strict";
export interface ProcessPolicy{readonly mode:ProcessIsolationMode;readonly maxRendererProcesses:number;readonly isolateExtensions:boolean;readonly isolatePrivateSessions:boolean;}
export const DEFAULT_PROCESS_POLICY:ProcessPolicy={mode:"origin",maxRendererProcesses:32,isolateExtensions:true,isolatePrivateSessions:true};
export function processKey(url:string,policy:ProcessPolicy,workspaceId?:string):string{const parsed=new URL(url);if(policy.mode==="workspace"&&workspaceId)return`workspace:${workspaceId}`;if(policy.mode==="site")return`site:${parsed.hostname.split(".").slice(-2).join(".")}`;return`origin:${parsed.origin}`;}
