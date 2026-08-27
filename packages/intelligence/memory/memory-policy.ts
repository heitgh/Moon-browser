export type MemoryScope="session"|"workspace"|"profile";
export interface MemoryPolicy{readonly enabled:boolean;readonly allowedScopes:ReadonlySet<MemoryScope>;readonly maximumEntries:number;readonly ttlMs:Partial<Record<MemoryScope,number>>;readonly storeSensitive:boolean;}
export const DEFAULT_MEMORY_POLICY:MemoryPolicy={enabled:true,allowedScopes:new Set(["session","workspace"]),maximumEntries:2_000,ttlMs:{session:86_400_000,workspace:2_592_000_000},storeSensitive:false};
