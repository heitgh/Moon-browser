export type DnsMode="system"|"custom"|"doh"|"dot";
export interface DnsPolicy{readonly mode:DnsMode;readonly servers:readonly string[];readonly providerUrl?:string;readonly fallbackToSystem:boolean;readonly blockFallback:boolean;}
export const DEFAULT_DNS_POLICY:DnsPolicy={mode:"system",servers:[],fallbackToSystem:true,blockFallback:false};
export function validateDnsPolicy(policy:DnsPolicy):void{if(policy.mode==="custom"&&!policy.servers.length)throw new Error("Custom DNS requires at least one server");if(["doh","dot"].includes(policy.mode)&&!policy.providerUrl)throw new Error(`${policy.mode.toUpperCase()} requires a provider URL`);for(const server of policy.servers)if(!/^[\w.:[\]-]+$/.test(server))throw new Error(`Invalid DNS server: ${server}`);}
