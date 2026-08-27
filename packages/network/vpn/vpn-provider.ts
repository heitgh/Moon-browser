import type { VpnProfile } from "./vpn-profile.js";import type { VpnState } from "./vpn-state.js";
export interface VpnServer{readonly id:string;readonly name:string;readonly country:string;readonly address:string;readonly protocols:readonly string[];}
export interface VpnProvider{readonly id:string;readonly name:string;listServers(signal?:AbortSignal):Promise<readonly VpnServer[]>;connect(profile:VpnProfile):Promise<void>;disconnect():Promise<void>;state():Promise<VpnState>;}
