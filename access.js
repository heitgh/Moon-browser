/* global document, window */
const form = document.querySelector("#unlock");
const input = document.querySelector("#password");
const submit = document.querySelector("#submit");
const status = document.querySelector("#status");
window.moonAccess.onNotice(message => { status.textContent = message; });
form.addEventListener("submit", async event => {
  event.preventDefault();
  const value = input.value; input.value = ""; submit.disabled = true;
  try {
    const result = await window.moonAccess.unlock(value);
    status.textContent = result ? "Desbloqueado. Abrindo perfil…" : "Senha incorreta. Aguarde antes de tentar novamente.";
    if (result) return;
  } catch (error) { status.textContent = error?.message || "Não foi possível desbloquear o perfil."; }
  submit.disabled = false; input.focus();
});
