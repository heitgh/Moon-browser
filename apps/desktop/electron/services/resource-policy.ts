// Nexus Inc. — fail closed: only explicitly reload-safe origins can be suspended.
import type { PageActivity, ResourceSettings } from "../../../../packages/ipc/resource-policy-contract.js";
export class ResourcePolicy {
  precheck(settings: ResourceSettings, tab: {url: string; active: boolean; private: boolean; loading: boolean}, idleMs: number, requested: boolean): readonly string[] {
    const reasons: string[] = [];
    if (tab.active) reasons.push("Aba ativa.");
    if (tab.private) reasons.push("Janela privada ou temporária.");
    if (tab.loading) reasons.push("Carregamento em andamento.");
    let origin = "";
    try { const url = new URL(tab.url); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); origin = url.origin; if (url.search || url.hash || url.username || url.password) reasons.push("Endereço com parâmetros, fragmento ou credenciais não é elegível para recarga automática."); } catch { reasons.push("Somente páginas HTTP/HTTPS podem ser suspensas."); }
    if (!settings.reloadSafeOrigins.includes(origin)) reasons.push("Site não autorizado para recarga sem perda de estado.");
    if (settings.exceptions.includes(origin)) reasons.push("Site incluído nas exceções.");
    if (!requested && (!settings.automatic || !Number.isFinite(idleMs) || idleMs < settings.idleMinutes * 60_000)) reasons.push("Suspensão automática desativada ou tempo de inatividade insuficiente.");
    return [...new Set(reasons)];
  }
  evaluate(settings: ResourceSettings, tab: {url: string; active: boolean; private: boolean; loading: boolean}, activity: PageActivity | null, idleMs: number, requested: boolean): readonly string[] {
    const reasons = [...this.precheck(settings, tab, idleMs, requested)];
    if (!activity) reasons.push("Não foi possível verificar a atividade da página.");
    else {
      if (activity.url !== tab.url) reasons.push("O documento mudou; avalie a aba novamente.");
      if (!activity.eligible || activity.reasons.length) reasons.push(...(activity.reasons.length ? activity.reasons : ["Atividade não elegível para suspensão."]));
    }
    return [...new Set(reasons)];
  }
}
