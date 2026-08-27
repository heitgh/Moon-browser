export type NetworkRequestMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "CONNECT"
  | "TRACE";

export type NetworkRequestType =
  | "main_frame"
  | "sub_frame"
  | "script"
  | "stylesheet"
  | "image"
  | "font"
  | "media"
  | "xhr"
  | "fetch"
  | "websocket"
  | "other";

export type NetworkAction =
  | "allow"
  | "block"
  | "redirect"
  | "modify";

export interface NetworkRequest {
  readonly id: string;
  readonly url: string;
  readonly method: NetworkRequestMethod;
  readonly type: NetworkRequestType;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly initiator?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timestamp: number;
}

export interface NetworkResponse {
  readonly requestId: string;
  readonly statusCode: number;
  readonly statusText?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly mimeType?: string;
  readonly timestamp: number;
}

export interface NetworkRuleDecision {
  readonly action: NetworkAction;
  readonly reason?: string;
  readonly redirectUrl?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface NetworkFilter {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;

  evaluate(
    request: NetworkRequest
  ): Promise<NetworkRuleDecision>;
}

export interface ProxyConfiguration {
  readonly enabled: boolean;
  readonly type: "direct" | "http" | "https" | "socks4" | "socks5";
  readonly host?: string;
  readonly port?: number;
  readonly username?: string;
  readonly password?: string;
  readonly bypass?: readonly string[];
}

export interface DnsConfiguration {
  readonly enabled: boolean;
  readonly provider?: string;
  readonly servers?: readonly string[];
  readonly encrypted?: boolean;
}

export interface NetworkPlatform {
  interceptRequest(
    request: NetworkRequest
  ): Promise<NetworkRuleDecision>;

  registerFilter(
    filter: NetworkFilter
  ): Promise<void>;

  unregisterFilter(
    filterId: string
  ): Promise<void>;

  clearFilters(): Promise<void>;

  setProxy(
    configuration: ProxyConfiguration
  ): Promise<void>;

  getProxy(): Promise<ProxyConfiguration>;

  setDns(
    configuration: DnsConfiguration
  ): Promise<void>;

  getDns(): Promise<DnsConfiguration>;

  clearNetworkCache(): Promise<void>;

  clearCookies(): Promise<void>;

  clearBrowsingData(): Promise<void>;

  getActiveConnections(): Promise<readonly NetworkRequest[]>;

  shutdown(): Promise<void>;
}