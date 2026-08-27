import type { PermissionRequest } from "../contracts.js";
import { button, element, icon } from "../dom.js";

const PERMISSION_NAMES: Readonly<Record<string, string>> = {
  media: "câmera ou microfone",
  camera: "câmera",
  microphone: "microfone",
  notifications: "notificações",
  geolocation: "localização",
  midi: "dispositivos MIDI",
  fullscreen: "tela cheia",
  "display-capture": "captura de tela"
};

export interface PermissionPromptView {
  readonly element: HTMLElement;
  readonly disableActions: () => void;
}

export function createPermissionPrompt(
  request: PermissionRequest,
  onRespond: (granted: boolean) => void
): PermissionPromptView {
  const overlay = element("div", "moon-permission-overlay");
  const prompt = element("section", "moon-permission-prompt");
  prompt.setAttribute("role", "alertdialog");
  prompt.setAttribute("aria-modal", "true");

  const mark = element("div", "moon-permission-mark");
  mark.append(icon("shield"));
  prompt.append(
    mark,
    element("h2", "", "Permissão do site"),
    element("p", "", `${request.origin} quer acessar ${PERMISSION_NAMES[request.permission] ?? request.permission}.`),
    element("small", "", "O Moon negará automaticamente se você não responder.")
  );

  const actions = element("div", "moon-permission-actions");
  const deny = button("moon-secondary-button", "Negar permissão");
  deny.append(element("span", "", "Negar"));
  const allow = button("moon-primary-button", "Permitir acesso");
  allow.append(element("span", "", "Permitir"));
  deny.addEventListener("click", () => onRespond(false));
  allow.addEventListener("click", () => onRespond(true));
  actions.append(deny, allow);
  prompt.append(actions);
  overlay.append(prompt);

  return {
    element: overlay,
    disableActions: () => {
      deny.disabled = true;
      allow.disabled = true;
    }
  };
}
