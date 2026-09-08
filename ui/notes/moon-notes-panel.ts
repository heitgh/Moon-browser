import type { ProfileDataMutation, ProfileNoteDocument } from "../../packages/ipc/profile-data-contract.js";
import { button, element, icon } from "../browser-shell/dom.js";

export interface MoonNotesPanelOptions {
  readonly mutate: (mutation: ProfileDataMutation) => Promise<boolean>;
  readonly refresh: () => Promise<void>;
  readonly onScratchChanged: (content: string) => void;
  readonly activeContext: () => { readonly url?: string; readonly tabId?: string; readonly workspaceId?: string };
  readonly importMarkdown: () => Promise<ProfileNoteDocument | null>;
  readonly exportMarkdown: (id: string) => Promise<boolean>;
}

export class MoonNotesPanel {
  readonly element = element("div", "moon-notes");
  #documents: readonly ProfileNoteDocument[] = [];
  #scratchpad = "";
  #private = false;
  #selectedId: string | undefined;
  #mode: "all" | "favorites" | "trash" = "all";
  #query = "";
  #preview = false;
  #saveTimer: number | undefined;

  constructor(readonly options: MoonNotesPanelOptions) {}

  update(documents: readonly ProfileNoteDocument[], scratchpad: string, privateWindow: boolean): void {
    this.#documents = documents; this.#scratchpad = scratchpad; this.#private = privateWindow;
    if (this.#selectedId && !documents.some(note => note.id === this.#selectedId)) this.#selectedId = undefined;
  }

  render(container: HTMLElement): void { this.#render(); container.append(this.element); }

  #render(): void {
    this.element.replaceChildren();
    const hero = element("div", "moon-tool-hero"); hero.append(icon("note"), element("strong", "", "Moon Notes"));
    const actions = element("div", "moon-notes-top-actions");
    const newNote = button("moon-primary-button", "Criar nova nota", "plus"); newNote.append(element("span", "", "Nova nota")); newNote.disabled = this.#private; newNote.addEventListener("click", () => void this.#create("note"));
    const newFolder = button("moon-secondary-button", "Criar nova pasta de notas", "folder"); newFolder.append(element("span", "", "Nova pasta")); newFolder.disabled = this.#private; newFolder.addEventListener("click", () => void this.#create("folder"));
    const importMarkdown = button("moon-secondary-button", "Importar arquivo Markdown", "download"); importMarkdown.append(element("span", "", "Importar .md")); importMarkdown.disabled = this.#private; importMarkdown.addEventListener("click", () => void this.#importMarkdown()); actions.append(newNote, newFolder, importMarkdown);
    this.element.append(hero, element("p", "moon-drawer-description", "Notas Markdown locais, pastas, tags, backlinks, versões e lixeira. Nada é enviado para serviços externos."), actions);
    if (!this.#documents.length) { this.#legacyScratchpad(); return; }
    const controls = element("div", "moon-notes-controls");
    const search = element("input", "moon-settings-input"); search.type = "search"; search.placeholder = "Buscar notas, conteúdo ou tags"; search.value = this.#query; search.setAttribute("aria-label", "Buscar no Moon Notes"); search.addEventListener("input", () => { this.#query = search.value; this.#render(); requestAnimationFrame(() => this.element.querySelector<HTMLInputElement>('[aria-label="Buscar no Moon Notes"]')?.focus()); });
    const modes = element("div", "moon-notes-modes"); for (const [mode, label] of [["all", "Notas"], ["favorites", "Favoritas"], ["trash", "Lixeira"]] as const) { const control = button(`moon-text-button${this.#mode === mode ? " is-active" : ""}`, label); control.append(element("span", "", label)); control.addEventListener("click", () => { this.#mode = mode; this.#selectedId = undefined; this.#render(); }); modes.append(control); } controls.append(search, modes); this.element.append(controls);
    const body = element("div", "moon-notes-body"); const list = element("nav", "moon-notes-list"); list.setAttribute("aria-label", "Notas e pastas");
    const candidates = this.#filtered();
    for (const note of candidates) {
      const row = button(`moon-notes-list-item${note.id === this.#selectedId ? " is-active" : ""}`, `Abrir ${note.kind === "folder" ? "pasta" : "nota"} ${note.title}`, note.kind === "folder" ? "folder" : "note"); row.style.setProperty("--moon-note-depth", String(this.#depth(note))); const copy = element("span", "moon-list-copy"); copy.append(element("strong", "", `${note.favorite ? "★ " : ""}${note.title}`), element("small", "", note.deletedAt ? "Na lixeira" : note.kind === "folder" ? "Pasta" : `${note.tags.join(", ") || "Sem tags"} · r${note.revision}`)); row.append(copy); row.addEventListener("click", () => { this.#selectedId = note.id; this.#render(); }); list.append(row);
    }
    if (!candidates.length) list.append(element("p", "moon-widget-empty", "Nenhuma nota encontrada."));
    const selected = this.#selectedId ? this.#documents.find(note => note.id === this.#selectedId) : candidates.find(note => note.kind === "note") ?? candidates[0]; if (selected) this.#selectedId = selected.id;
    const editor = element("section", "moon-notes-editor"); if (selected) this.#editor(editor, selected); else editor.append(element("p", "moon-widget-empty", "Selecione ou crie uma nota.")); body.append(list, editor); this.element.append(body);
  }

  #legacyScratchpad(): void {
    const note = element("p", "moon-recovery-note", "Seu bloco rápido continua compatível. Crie uma nota para ativar pastas, Markdown, backlinks e histórico de versões.");
    const textarea = element("textarea", "moon-notes-input"); textarea.value = this.#scratchpad; textarea.placeholder = "Suas anotações ficam salvas localmente neste perfil do Moon."; textarea.rows = 12; textarea.disabled = this.#private;
    const status = element("span", "moon-notes-status", this.#private ? "Desativado nesta janela" : "Salvo no perfil");
    textarea.addEventListener("input", () => { this.#scratchpad = textarea.value; this.options.onScratchChanged(this.#scratchpad); status.textContent = "Salvando…"; if (this.#saveTimer !== undefined) clearTimeout(this.#saveTimer); this.#saveTimer = window.setTimeout(() => { void this.options.mutate({ type: "notes:save", content: this.#scratchpad }).then(saved => { status.textContent = saved ? "Salvo no perfil" : "Falha ao salvar"; }); }, 250); }); this.element.append(note, textarea, status);
  }

  #editor(editor: HTMLElement, note: ProfileNoteDocument): void {
    if (note.deletedAt) { const actions = element("div", "moon-notes-editor-actions"); const restore = button("moon-primary-button", `Restaurar ${note.title}`, "reload"); restore.append(element("span", "", "Restaurar")); restore.addEventListener("click", () => void this.#mutate({ type: "note:restore", id: note.id })); const purge = button("moon-secondary-button", `Excluir permanentemente ${note.title}`, "trash"); purge.append(element("span", "", "Excluir para sempre")); purge.addEventListener("click", () => { if (confirm(`Excluir permanentemente “${note.title}”?`)) void this.#mutate({ type: "note:purge", id: note.id }); }); actions.append(restore, purge); editor.append(element("h3", "", note.title), element("p", "moon-recovery-note", "Este item está na lixeira."), actions); return; }
    const title = element("input", "moon-notes-title"); title.value = note.title; title.maxLength = 200; title.disabled = this.#private; title.setAttribute("aria-label", "Título da nota");
    const toolbar = element("div", "moon-notes-editor-actions"); const favorite = button("moon-icon-button", note.favorite ? "Remover nota dos favoritos" : "Favoritar nota", "star"); favorite.dataset.active = String(note.favorite); const preview = button("moon-secondary-button", this.#preview ? "Editar Markdown" : "Visualizar Markdown", this.#preview ? "note" : "search"); preview.append(element("span", "", this.#preview ? "Editar" : "Preview")); preview.addEventListener("click", () => { this.#preview = !this.#preview; this.#render(); }); const exportMarkdown = button("moon-icon-button", `Exportar ${note.title} como Markdown`, "download"); exportMarkdown.disabled = this.#private || note.kind === "folder"; exportMarkdown.addEventListener("click", () => void this.options.exportMarkdown(note.id)); const remove = button("moon-icon-button", `Mover ${note.title} para a lixeira`, "trash"); remove.disabled = this.#private; remove.addEventListener("click", () => void this.#mutate({ type: "note:delete", id: note.id })); toolbar.append(favorite, preview, exportMarkdown, remove);
    const metadata = element("div", "moon-notes-metadata"); const tags = element("input", "moon-settings-input"); tags.value = note.tags.join(", "); tags.placeholder = "tags, separadas, por vírgula"; tags.setAttribute("aria-label", "Tags da nota"); tags.disabled = this.#private; const parent = element("select", "moon-select"); parent.setAttribute("aria-label", "Pasta da nota"); parent.append(option("", "Sem pasta")); this.#documents.filter(item => item.kind === "folder" && !item.deletedAt && item.id !== note.id).forEach(folder => parent.append(option(folder.id, folder.title))); parent.value = note.parentId ?? ""; parent.disabled = this.#private; metadata.append(tags, parent);
    if (note.kind === "folder") { const status = element("span", "moon-notes-status", `Pasta · revisão ${note.revision}`); favorite.addEventListener("click", () => void this.#save(note, { title: title.value, favorite: !note.favorite, parentId: parent.value || undefined }, status)); title.addEventListener("change", () => void this.#save(note, { title: title.value, parentId: parent.value || undefined }, status)); parent.addEventListener("change", () => void this.#save(note, { title: title.value, parentId: parent.value || undefined }, status)); editor.append(title, toolbar, metadata, status); return; }
    const content = element("textarea", "moon-notes-input"); content.value = note.content; content.rows = 16; content.placeholder = "Markdown, [[links internos]], listas e checklists…"; content.disabled = this.#private; const previewBody = element("div", "moon-notes-preview"); if (this.#preview) renderMarkdown(previewBody, note.content, wikiTitle => { const target = this.#documents.find(candidate => candidate.title === wikiTitle && !candidate.deletedAt); if (target) { this.#selectedId = target.id; this.#preview = false; this.#render(); } }); else previewBody.hidden = true;
    const context = button("moon-text-button", "Vincular nota à página atual", "globe"); context.append(element("span", "", note.sourceUrl ? "Atualizar vínculo da página" : "Vincular à página atual")); context.disabled = this.#private || !this.options.activeContext().url; const status = element("span", "moon-notes-status", `Salvo · revisão ${note.revision}`);
    const values = () => ({ title: title.value, content: content.value, tags: tags.value.split(",").map(value => value.trim()).filter(Boolean), parentId: parent.value || undefined });
    const schedule = (): void => { status.textContent = "Salvando…"; if (this.#saveTimer !== undefined) clearTimeout(this.#saveTimer); this.#saveTimer = window.setTimeout(() => void this.#save(note, values(), status), 350); };
    title.addEventListener("input", schedule); content.addEventListener("input", schedule); tags.addEventListener("change", schedule); parent.addEventListener("change", schedule); favorite.addEventListener("click", () => void this.#save(note, { ...values(), favorite: !note.favorite }, status)); context.addEventListener("click", () => { const active = this.options.activeContext(); void this.#save(note, { ...values(), sourceUrl: active.url, tabId: active.tabId, workspaceId: active.workspaceId }, status); }); content.addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "s") { event.preventDefault(); if (this.#saveTimer !== undefined) clearTimeout(this.#saveTimer); void this.#save(note, values(), status); } });
    const backlinks = this.#documents.filter(candidate => candidate.id !== note.id && !candidate.deletedAt && candidate.content.includes(`[[${note.title}]]`)); const related = element("div", "moon-notes-related"); related.append(element("strong", "", `Backlinks (${backlinks.length})`)); backlinks.forEach(candidate => { const open = button("moon-text-button", `Abrir backlink ${candidate.title}`); open.append(element("span", "", candidate.title)); open.addEventListener("click", () => { this.#selectedId = candidate.id; this.#render(); }); related.append(open); });
    const versions = element("details", "moon-notes-versions"); versions.append(element("summary", "", `Versões locais (${note.versions.length})`)); [...note.versions].reverse().forEach(version => { const restore = button("moon-text-button", `Restaurar revisão ${version.revision}`); restore.append(element("span", "", `r${version.revision} · ${new Date(version.updatedAt).toLocaleString("pt-BR")}`)); restore.addEventListener("click", () => { if (confirm(`Restaurar a revisão ${version.revision}? A versão atual continuará no histórico.`)) void this.#save(note, { title: version.title, content: version.content }, status); }); versions.append(restore); });
    const source = note.sourceUrl ? element("a", "moon-note-source", note.sourceUrl) : element("span"); if (source instanceof HTMLAnchorElement) { source.href = note.sourceUrl!; source.target = "_blank"; source.rel = "noreferrer noopener"; }
    editor.append(title, toolbar, metadata, this.#preview ? previewBody : content, context, source, related, versions, status);
  }

  async #save(note: ProfileNoteDocument, patch: Partial<Pick<ProfileNoteDocument, "title" | "content" | "favorite" | "tags" | "parentId" | "sourceUrl" | "tabId" | "workspaceId">>, status: HTMLElement): Promise<void> {
    if (this.#private) return; this.#saveTimer = undefined;
    const parentId = patch.parentId === undefined ? note.parentId : patch.parentId; const sourceUrl = patch.sourceUrl ?? note.sourceUrl; const tabId = patch.tabId ?? note.tabId; const workspaceId = patch.workspaceId ?? note.workspaceId;
    const value = { id: note.id, kind: note.kind, title: patch.title ?? note.title, content: note.kind === "folder" ? "" : patch.content ?? note.content, format: note.format, pinned: note.pinned, favorite: patch.favorite ?? note.favorite, tags: patch.tags ?? note.tags, ...(parentId ? { parentId } : {}), ...(sourceUrl ? { sourceUrl } : {}), ...(tabId ? { tabId } : {}), ...(workspaceId ? { workspaceId } : {}), ...(note.sessionId ? { sessionId: note.sessionId } : {}) };
    const saved = await this.options.mutate({ type: "note:save", value, expectedRevision: note.revision }); status.textContent = saved ? "Salvo" : "Conflito ao salvar"; if (saved) await this.options.refresh();
  }

  async #create(kind: "note" | "folder"): Promise<void> { const id = `note-${crypto.randomUUID()}`; const parentId = this.#selectedId && this.#documents.find(note => note.id === this.#selectedId)?.kind === "folder" ? this.#selectedId : undefined; const saved = await this.options.mutate({ type: "note:save", value: { id, kind, ...(parentId ? { parentId } : {}), title: kind === "folder" ? "Nova pasta" : "Nova nota", content: "", format: "markdown", pinned: false, favorite: false, tags: [] }, expectedRevision: 0 }); if (saved) { this.#selectedId = id; this.#mode = "all"; await this.options.refresh(); } }
  async #importMarkdown(): Promise<void> { const imported = await this.options.importMarkdown(); if (!imported) return; this.#selectedId = imported.id; this.#mode = "all"; await this.options.refresh(); }
  async #mutate(mutation: ProfileDataMutation): Promise<void> { if (await this.options.mutate(mutation)) { if (mutation.type === "note:purge") this.#selectedId = undefined; await this.options.refresh(); } }
  #filtered(): readonly ProfileNoteDocument[] { const query = this.#query.trim().toLocaleLowerCase("pt-BR"); return this.#documents.filter(note => this.#mode === "trash" ? Boolean(note.deletedAt) : !note.deletedAt && (this.#mode !== "favorites" || note.favorite)).filter(note => !query || `${note.title} ${note.content} ${note.tags.join(" ")}`.toLocaleLowerCase("pt-BR").includes(query)).sort((left, right) => Number(right.kind === "folder") - Number(left.kind === "folder") || Number(right.favorite) - Number(left.favorite) || right.updatedAt - left.updatedAt); }
  #depth(note: ProfileNoteDocument): number { let depth = 0; let parentId = note.parentId; const seen = new Set<string>(); while (parentId && depth < 5 && !seen.has(parentId)) { seen.add(parentId); depth += 1; parentId = this.#documents.find(candidate => candidate.id === parentId)?.parentId; } return depth; }
}

function option(value: string, label: string): HTMLOptionElement { const item = element("option", "", label); item.value = value; return item; }

export function renderMarkdown(container: HTMLElement, markdown: string, openWikiLink: (title: string) => void): void {
  container.replaceChildren(); let inCode = false; const code: string[] = [];
  const flushCode = (): void => { if (!code.length) return; const pre = element("pre"); pre.append(element("code", "", code.join("\n"))); container.append(pre); code.length = 0; };
  for (const raw of markdown.split(/\r?\n/)) {
    if (raw.startsWith("```")) { if (inCode) flushCode(); inCode = !inCode; continue; }
    if (inCode) { code.push(raw); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(raw); const quote = /^>\s?(.*)$/.exec(raw); const task = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(raw); const list = /^[-*]\s+(.+)$/.exec(raw);
    const block = heading ? element(`h${heading[1]!.length}` as keyof HTMLElementTagNameMap) : quote ? element("blockquote") : task || list ? element("div", "moon-notes-list-line") : element("p"); const content = heading?.[2] ?? quote?.[1] ?? task?.[2] ?? list?.[1] ?? raw;
    if (task) { const checkbox = element("input"); checkbox.type = "checkbox"; checkbox.checked = task[1]!.toLocaleLowerCase() === "x"; checkbox.disabled = true; block.append(checkbox); }
    appendInline(block, content, openWikiLink); container.append(block);
  }
  flushCode();
}

function appendInline(container: HTMLElement, text: string, openWikiLink: (title: string) => void): void {
  const pattern = /\[\[([^\]]{1,200})\]\]|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g; let offset = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) { if (match.index > offset) container.append(document.createTextNode(text.slice(offset, match.index))); if (match[1]) { const link = button("moon-note-wikilink", `Abrir nota ${match[1]}`); link.append(element("span", "", match[1])); link.addEventListener("click", () => openWikiLink(match[1]!)); container.append(link); } else if (match[2] && match[3]) { const link = element("a", "", match[2]); link.href = match[3]; link.target = "_blank"; link.rel = "noreferrer noopener"; container.append(link); } else if (match[4]) container.append(element("code", "", match[4])); else if (match[5]) container.append(element("strong", "", match[5])); offset = pattern.lastIndex; }
  if (offset < text.length) container.append(document.createTextNode(text.slice(offset)));
}
