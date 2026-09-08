/** Local research primitives. Source text is data; it never becomes executable code. */
export interface ResearchSource { readonly tabId: string; readonly title: string; readonly url: string; readonly text: string; readonly truncated: boolean; }
export type ResearchMode = "short" | "detailed" | "question" | "flashcards" | "compare" | "checklist";
export interface ResearchResult { readonly title: string; readonly markdown: string; readonly sources: readonly ResearchSource[]; }
export const MAX_SOURCE_CHARS = 60_000;
export const MEMORY_CATEGORIES = ["preferences", "projects", "pages", "notes", "sessions"] as const;
export type MemoryCategory = typeof MEMORY_CATEGORIES[number];
export interface MemoryItem { readonly id: string; readonly category: MemoryCategory; readonly title: string; readonly markdown: string; readonly urls: readonly string[]; readonly createdAt: number; readonly expiresAt: number; }
export interface ResearchMemory { readonly version: 1; readonly revision: number; readonly enabled: readonly MemoryCategory[]; readonly retentionDays: number; readonly items: readonly MemoryItem[]; }
export const emptyMemory = (): ResearchMemory => ({ version: 1, revision: 0, enabled: [], retentionDays: 30, items: [] });
export function scopeId(value: unknown): string { if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error("Workspace inválido."); return value; }
export function researchUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw new Error("URL inválida.");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Somente páginas HTTP/HTTPS sem credenciais são aceitas.");
  if (/(bank|banco|banking|health|saude|saúde|medical|patient|paciente|hospital|account|conta|login|signin|checkout|oauth|token|password|senha)/i.test(decodeURIComponent(url.hostname + url.pathname + url.search))) throw new Error("Página possivelmente sensível: pesquisa e memória indisponíveis.");
  return url.href;
}
export function parseSources(value: unknown): ResearchSource[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) throw new Error("Selecione entre uma e cinco abas.");
  return value.map((source: unknown) => {
    if (!source || typeof source !== "object") throw new Error("Fonte inválida.");
    const item = source as Record<string, unknown>;
    if (typeof item.title !== "string" || typeof item.text !== "string" || item.text.length > MAX_SOURCE_CHARS || typeof item.tabId !== "string" || item.tabId.length > 100) throw new Error("Fonte inválida ou grande demais.");
    return { title: item.title.slice(0, 200), text: item.text, url: researchUrl(item.url), tabId: item.tabId, truncated: item.truncated === true };
  });
}
const normalize = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const quote = (value: string): string => value.replace(/[\r\n]+/g, " ");
export function localResearch(sources: readonly ResearchSource[], mode: ResearchMode, query = ""): ResearchResult {
  const checked = parseSources(sources);
  const terms = normalize(query).match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const passages = checked.flatMap((source, index) => source.text.split(/\n+|(?<=[.!?])\s+/).filter(text => text.trim().length >= 30).slice(0, 1000).map(text => ({ text: text.trim().slice(0, 1200), index: index + 1 })));
  let selected = passages;
  if (mode === "question") selected = terms.length ? passages.map(p => ({ ...p, score: terms.filter(t => normalize(p.text).includes(t)).length })).filter(p => p.score > 0).sort((a, b) => b.score - a.score) : [];
  const limit = mode === "detailed" ? 12 : 5;
  selected = selected.slice(0, limit);
  const titles: Record<ResearchMode, string> = { short: "Trechos principais", detailed: "Leitura detalhada", question: "Trechos relacionados à pergunta", flashcards: "Cartões de revisão", compare: "Comparação das fontes", checklist: "Roteiro de estudo" };
  let body = selected.map(p => `> ${quote(p.text)} [${p.index}]`).join("\n\n");
  if (mode === "flashcards") body = selected.map((p, i) => `### Cartão ${i + 1}\n\nQual trecho da fonte ${p.index} você consegue explicar com suas palavras?\n\n**Resposta de referência:** ${quote(p.text)} [${p.index}]`).join("\n\n");
  if (mode === "checklist") body = selected.map(p => `- [ ] Ler e explicar: ${quote(p.text)} [${p.index}]`).join("\n\n");
  if (mode === "compare") body = "| Fonte | Trecho inicial |\n| --- | --- |\n" + checked.map((s, i) => `| ${quote(s.title).replace(/\|/g, "\\|")} [${i + 1}] | ${quote(s.text.slice(0, 350)).replace(/\|/g, "\\|")} |`).join("\n");
  if (!body) body = "Não encontrei base textual suficiente. Nenhuma resposta foi inventada.";
  const refs = checked.map((s, i) => `[${i + 1}] ${quote(s.title)} — ${s.url}${s.truncated ? " (leitura limitada a 60.000 caracteres)" : ""}`).join("\n\n");
  return { title: titles[mode], sources: checked, markdown: `# ${titles[mode]}\n\nLeitura local por extração de trechos; não é um resumo ou resposta de IA generativa. Confira o contexto nas fontes.${query ? `\n\nPergunta: ${quote(query.slice(0, 1000))}` : ""}\n\n${body}\n\n## Fontes\n\n${refs}` };
}
export function parseMemory(value: unknown, now = Date.now()): ResearchMemory {
  if (!value || typeof value !== "object" || JSON.stringify(value).length > 2_000_000) throw new Error("Memória inválida ou acima do limite de 2 MB.");
  const v = value as ResearchMemory;
  if (v.version !== 1 || !Number.isSafeInteger(v.revision) || v.revision < 0 || ![7, 30, 90].includes(v.retentionDays) || !Array.isArray(v.enabled) || !v.enabled.every(c => MEMORY_CATEGORIES.includes(c)) || !Array.isArray(v.items) || v.items.length > 100) throw new Error("Formato de memória inválido.");
  const ids = new Set<string>();
  const items = v.items.map(item => {
    if (!item || !MEMORY_CATEGORIES.includes(item.category) || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 200 || typeof item.markdown !== "string" || item.markdown.length > 30_000 || !Array.isArray(item.urls) || item.urls.length > 50 || !Number.isSafeInteger(item.createdAt) || !Number.isSafeInteger(item.expiresAt) || item.expiresAt <= item.createdAt || item.expiresAt > now + 90 * 86400_000) throw new Error("Item de memória inválido.");
    ids.add(item.id);
    return { id: item.id, category: item.category, title: item.title, markdown: item.markdown, urls: item.urls.map(researchUrl), createdAt: item.createdAt, expiresAt: item.expiresAt };
  }).filter(item => item.expiresAt > now);
  return { version: 1, revision: v.revision, enabled: [...new Set(v.enabled)], retentionDays: v.retentionDays, items };
}
