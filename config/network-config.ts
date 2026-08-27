import type { DnsPolicy } from "@moon/network";
export interface NetworkConfiguration{readonly adblock:boolean;readonly trackingProtection:"off"|"standard"|"strict";readonly dns:DnsPolicy;readonly proxyProfileId?:string;readonly vpnProfileId?:string;}
export const DEFAULT_NETWORK_CONFIG:NetworkConfiguration={adblock:true,trackingProtection:"strict",dns:{mode:"system",servers:[],fallbackToSystem:true,blockFallback:false}};
