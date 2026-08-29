export type FeatureFlag="ai"|"smart-spaces"|"timeline"|"extensions"|"plugins"|"vpn"|"mobile-sync"|"experimental-ui";
export type FeatureFlags=Readonly<Record<FeatureFlag,boolean>>;
export const DEFAULT_FEATURE_FLAGS:FeatureFlags={ai:false,"smart-spaces":false,timeline:false,extensions:false,plugins:false,vpn:false,"mobile-sync":false,"experimental-ui":false};
export const RELEASE_GATED_FEATURE_FLAGS:ReadonlySet<FeatureFlag>=new Set(["ai"]);
export function featureEnabled(flags:FeatureFlags,flag:FeatureFlag,overrides:Partial<FeatureFlags>={}):boolean{
  if(RELEASE_GATED_FEATURE_FLAGS.has(flag))return false;
  return overrides[flag]??flags[flag];
}
