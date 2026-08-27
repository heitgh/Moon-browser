export type ProxyProtocol="http"|"https"|"socks4"|"socks5";
export interface ProxyProfile{readonly id:string;readonly name:string;readonly protocol:ProxyProtocol;readonly host:string;readonly port:number;readonly username?:string;readonly passwordReference?:string;readonly bypass:readonly string[];readonly createdAt:number;readonly updatedAt:number;}
