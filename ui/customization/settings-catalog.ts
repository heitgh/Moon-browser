import type { SettingsMode } from "./customization-schema.js";

export type SettingsSection = "appearance" | "layout" | "home" | "typography" | "search" | "data";
export interface SettingDefinition { readonly id: string; readonly section: SettingsSection; readonly category: string; readonly title: string; readonly description: string; readonly keywords: readonly string[]; readonly level: Exclude<SettingsMode, "customize">; readonly scope: "global" | "workspace" | "both"; }

export const SETTINGS_CATALOG: readonly SettingDefinition[] = [
  { id: "theme-mode", section: "appearance", category: "Aparência", title: "Modo claro, escuro ou automático", description: "Escolha como o Moon acompanha a luz do ambiente.", keywords: ["tema", "claro", "escuro", "automático", "light", "dark"], level: "essential", scope: "both" },
  { id: "active-theme", section: "appearance", category: "Temas", title: "Tema ativo e biblioteca", description: "Aplique, salve, importe ou reverta um tema.", keywords: ["tema", "moontheme", "aparência", "paleta"], level: "essential", scope: "both" },
  { id: "wallpaper", section: "appearance", category: "Wallpaper", title: "Imagem de fundo", description: "Escolha wallpaper, cor ou gradiente e ajuste o enquadramento.", keywords: ["papel de parede", "imagem de fundo", "background", "wallpaper", "fundo"], level: "essential", scope: "both" },
  { id: "density", section: "layout", category: "Layout", title: "Densidade e escala", description: "Deixe a interface compacta, equilibrada, confortável ou pronta para toque.", keywords: ["tamanho", "escala", "compacto", "confortável", "touch", "zoom"], level: "essential", scope: "both" },
  { id: "sidebar-position", section: "layout", category: "Sidebar", title: "Posição da sidebar", description: "Mova a barra lateral ou use um modo discreto.", keywords: ["lado", "esquerda", "direita", "flutuante", "posição", "sidebar"], level: "essential", scope: "both" },
  { id: "sidebar-width", section: "layout", category: "Sidebar", title: "Largura da sidebar", description: "Ajuste a grossura com limites seguros.", keywords: ["grossura", "largura", "width", "estreita", "larga", "sidebar"], level: "essential", scope: "both" },
  { id: "sidebar-auto-hide", section: "layout", category: "Sidebar", title: "Ocultar automaticamente", description: "Revela a sidebar ao aproximar o cursor da borda.", keywords: ["sumir barra", "auto hide", "esconder sidebar", "revelar"], level: "advanced", scope: "both" },
  { id: "workspace-visibility", section: "layout", category: "Workspaces", title: "Visibilidade das workspaces", description: "Mostre sempre, recolha, revele na Home ou oculte com recuperação garantida.", keywords: ["sumir workspace", "esconder espaços", "ocultar workspaces", "workspace visibility", "espaços"], level: "essential", scope: "both" },
  { id: "toolbar", section: "layout", category: "Toolbar", title: "Toolbar e omnibox", description: "Posição, altura e ordem das ações do navegador.", keywords: ["barra superior", "toolbar", "omnibox", "endereço", "botões"], level: "advanced", scope: "both" },
  { id: "home", section: "home", category: "Home", title: "Aparência da Home", description: "Organize cartões, atalhos e widgets da nova aba.", keywords: ["nova aba", "home", "widgets", "atalhos", "cartões"], level: "essential", scope: "both" },
  { id: "typography", section: "typography", category: "Tipografia", title: "Família e ritmo do texto", description: "Ajuste fonte, tamanho, peso, altura de linha e legibilidade.", keywords: ["tipografia", "fonte", "texto", "tamanho da letra", "peso", "altura de linha", "legibilidade"], level: "advanced", scope: "both" },
  { id: "search-engine", section: "search", category: "Pesquisa", title: "Mecanismo de busca", description: "Escolha e configure o buscador padrão.", keywords: ["google", "duckduckgo", "brave", "buscador", "search engine"], level: "essential", scope: "both" },
  { id: "favicons", section: "data", category: "Símbolos dos sites", title: "Favicons e cache local", description: "Controle símbolos, persistência e validade do cache.", keywords: ["ícone do site", "favicon", "símbolo", "site icon", "cache"], level: "advanced", scope: "both" },
  { id: "settings-page", section: "data", category: "Configurações", title: "Abrir configurações em página completa", description: "Use uma aba interna com mais espaço e links profundos.", keywords: ["abrir configurações em aba", "página completa", "settings page", "moon settings"], level: "essential", scope: "global" }
];

export function searchSettings(query: string): readonly SettingDefinition[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean); if (!terms.length) return [];
  return SETTINGS_CATALOG.map(item => ({ item, haystack: normalize([item.title, item.description, item.category, ...item.keywords].join(" ")) }))
    .filter(({ haystack }) => terms.every(term => haystack.includes(term)))
    .sort((left, right) => score(right.haystack, terms) - score(left.haystack, terms))
    .map(({ item }) => item);
}

function normalize(value: string): string { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim(); }
function score(value: string, terms: readonly string[]): number { return terms.reduce((total, term) => total + (value.startsWith(term) ? 4 : value.includes(` ${term}`) ? 2 : 1), 0); }
