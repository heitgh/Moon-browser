export type FeatureFlag="ai"|"smart-spaces"|"timeline"|"extensions"|"plugins"|"vpn"|"mobile-sync"|"experimental-ui";
export type FeatureFlags=Readonly<Record<FeatureFlag,boolean>>;
export const DEFAULT_FEATURE_FLAGS:FeatureFlags={ai:false,"smart-spaces":false,timeline:false,extensions:false,plugins:false,vpn:false,"mobile-sync":false,"experimental-ui":false};
export function featureEnabled(flags:FeatureFlags,flag:FeatureFlag,overrides:Partial<FeatureFlags>={}):boolean{return overrides[flag]??flags[flag];}
