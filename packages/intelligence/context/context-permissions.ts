import type { IntelligenceContextFragment,IntelligenceContextKind } from "./context-source.js";
export interface ContextPermissionPolicy{readonly allowedKinds:ReadonlySet<IntelligenceContextKind>;readonly allowSensitive:boolean;readonly allowPrivate:boolean;}
export function filterPermittedContext(fragments:readonly IntelligenceContextFragment[],policy:ContextPermissionPolicy):readonly IntelligenceContextFragment[]{return fragments.filter(item=>policy.allowedKinds.has(item.kind)&&(item.sensitivity!=="sensitive"||policy.allowSensitive)&&(item.sensitivity!=="private"||policy.allowPrivate));}
