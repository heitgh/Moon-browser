export type VpnStatus="disconnected"|"connecting"|"connected"|"reconnecting"|"disconnecting"|"error";
export interface VpnState{readonly status:VpnStatus;readonly profileId?:string;readonly serverAddress?:string;readonly connectedAt?:number;readonly bytesReceived:number;readonly bytesSent:number;readonly error?:string;}
export const INITIAL_VPN_STATE:VpnState={status:"disconnected",bytesReceived:0,bytesSent:0};
