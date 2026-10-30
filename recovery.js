// Nexus Inc. — no file access or path selection happens in the renderer.
const backups = document.querySelector("#backups");
const status = document.querySelector("#status");
const restore = document.querySelector("#restore");
const exportButton = document.querySelector("#export");
const fresh = document.querySelector("#fresh");
const buttons = [restore, exportButton, fresh];
async function perform(message, action) {
  buttons.forEach(button => { button.disabled = true; });
  status.textContent = message;
  try { const result = await action(); status.textContent = result || "Ação cancelada."; }
  catch (error) { status.textContent = String(error?.message || "A ação falhou. Os arquivos originais foram preservados."); }
  finally { buttons.forEach(button => { button.disabled = false; }); restore.disabled = !backups.value; }
}
async function loadBackups() {
  try {
    const list = await window.moonRecovery.list();
    for (const item of list) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.source === "update" ? "Antes da atualização" : "Antes da migração"} — ${new Date(item.createdAt).toLocaleString("pt-BR")}`;
      backups.append(option);
    }
    restore.disabled = list.length === 0;
    status.textContent = list.length ? `${list.length} backup(s) íntegro(s) disponível(is).` : "Nenhum backup íntegro disponível. Você ainda pode exportar os arquivos ou criar um perfil limpo.";
  } catch { status.textContent = "Falha ao consultar os backups. Os dados originais não foram alterados."; }
}
restore.addEventListener("click", () => { if (backups.value) void perform("Restaurando…", () => window.moonRecovery.restore(backups.value)); });
exportButton.addEventListener("click", () => { void perform("Exportando arquivos…", () => window.moonRecovery.export()); });
fresh.addEventListener("click", () => { void perform("Preparando novo perfil…", () => window.moonRecovery.fresh()); });
void loadBackups();
