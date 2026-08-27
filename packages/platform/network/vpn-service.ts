export type VpnConnectionState = "disconnected" | "connecting" | "connected" | "disconnecting" | "error";
export interface VpnProfile { readonly id: string; readonly name: string; readonly provider: string; readonly endpoint: string; readonly protocol: string; }
export interface VpnAdapter { connect(profile: VpnProfile): Promise<void>; disconnect(): Promise<void>; state(): Promise<VpnConnectionState>; }
export class VpnService { constructor(readonly adapter: VpnAdapter) {} connect(profile: VpnProfile) { return this.adapter.connect(profile); } disconnect() { return this.adapter.disconnect(); } state() { return this.adapter.state(); } }
