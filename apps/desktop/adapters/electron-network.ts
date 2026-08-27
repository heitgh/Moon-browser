import type { DnsConfiguration, NetworkFilter, NetworkPlatform, NetworkRequest, NetworkRuleDecision, ProxyConfiguration } from "@moon/platform";
export interface ElectronNetworkBackend extends Omit<NetworkPlatform, "interceptRequest" | "registerFilter" | "unregisterFilter" | "clearFilters"> {}
export class ElectronNetworkPlatform implements NetworkPlatform {
  readonly #filters = new Map<string, NetworkFilter>();
  constructor(readonly backend: ElectronNetworkBackend) {}
  async interceptRequest(request: NetworkRequest): Promise<NetworkRuleDecision> { const filters = [...this.#filters.values()].filter(filter => filter.enabled).sort((a,b) => b.priority-a.priority); for (const filter of filters) { const result = await filter.evaluate(request); if (result.action !== "allow") return result; } return { action: "allow" }; }
  async registerFilter(filter: NetworkFilter) { this.#filters.set(filter.id, filter); } async unregisterFilter(id: string) { this.#filters.delete(id); } async clearFilters() { this.#filters.clear(); }
  setProxy(value: ProxyConfiguration) { return this.backend.setProxy(value); } getProxy() { return this.backend.getProxy(); } setDns(value: DnsConfiguration) { return this.backend.setDns(value); } getDns() { return this.backend.getDns(); } clearNetworkCache() { return this.backend.clearNetworkCache(); } clearCookies() { return this.backend.clearCookies(); } clearBrowsingData() { return this.backend.clearBrowsingData(); } getActiveConnections() { return this.backend.getActiveConnections(); } shutdown() { return this.backend.shutdown(); }
}
