export const LOCAL_PROFILE_REGISTRY_VERSION = 1;

export const LOCAL_PROFILE_AVATARS = ["moon", "person", "briefcase", "palette", "game"] as const;
export type LocalProfileAvatar = typeof LOCAL_PROFILE_AVATARS[number];
export type LocalProfileKind = "persistent" | "guest";

export interface LocalProfileSummary {
  readonly id: string;
  readonly name: string;
  readonly avatar: LocalProfileAvatar;
  readonly color: string;
  readonly kind: LocalProfileKind;
  readonly default: boolean;
  readonly createdAt: number;
  readonly lastUsedAt: number;
}

export interface CreateLocalProfileRequest {
  readonly name: string;
  readonly avatar: LocalProfileAvatar;
  readonly color: string;
}

export interface UpdateLocalProfileRequest extends CreateLocalProfileRequest {
  readonly id: string;
}

export interface DeleteLocalProfileRequest {
  readonly id: string;
  readonly confirmation: string;
  readonly backup: boolean;
}

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const COLOR = /^#[0-9a-f]{6}$/i;

export function parseLocalProfileId(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) throw new TypeError("ID de perfil inválido.");
  return value;
}

export function parseCreateLocalProfile(value: unknown): CreateLocalProfileRequest {
  const record = object(value, "perfil");
  return { name: profileName(record.name), avatar: profileAvatar(record.avatar), color: profileColor(record.color) };
}

export function parseUpdateLocalProfile(value: unknown): UpdateLocalProfileRequest {
  const record = object(value, "perfil");
  return { id: parseLocalProfileId(record.id), ...parseCreateLocalProfile(record) };
}

export function parseDeleteLocalProfile(value: unknown): DeleteLocalProfileRequest {
  const record = object(value, "exclusão de perfil");
  if (typeof record.confirmation !== "string" || record.confirmation.length > 80) throw new TypeError("Confirmação de exclusão inválida.");
  if (typeof record.backup !== "boolean") throw new TypeError("A opção de backup é obrigatória.");
  return { id: parseLocalProfileId(record.id), confirmation: record.confirmation, backup: record.backup };
}

export function validateLocalProfileSummary(value: unknown): LocalProfileSummary {
  const record = object(value, "metadados do perfil");
  if (record.kind !== "persistent" && record.kind !== "guest") throw new TypeError("Tipo de perfil inválido.");
  if (typeof record.default !== "boolean") throw new TypeError("Marcador de perfil padrão inválido.");
  if (!Number.isSafeInteger(record.createdAt) || Number(record.createdAt) < 0 || !Number.isSafeInteger(record.lastUsedAt) || Number(record.lastUsedAt) < 0) throw new TypeError("Datas do perfil inválidas.");
  return {
    id: parseLocalProfileId(record.id), name: profileName(record.name), avatar: profileAvatar(record.avatar), color: profileColor(record.color),
    kind: record.kind, default: record.default, createdAt: Number(record.createdAt), lastUsedAt: Number(record.lastUsedAt)
  };
}

function profileName(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("Nome do perfil inválido.");
  const name = value.trim();
  if (!name || name.length > 40 || [...name].some(character => { const code = character.charCodeAt(0); return code <= 31 || code === 127; })) throw new TypeError("Use um nome de perfil entre 1 e 40 caracteres.");
  return name;
}

function profileAvatar(value: unknown): LocalProfileAvatar {
  if (typeof value !== "string" || !(LOCAL_PROFILE_AVATARS as readonly string[]).includes(value)) throw new TypeError("Avatar de perfil inválido.");
  return value as LocalProfileAvatar;
}

function profileColor(value: unknown): string {
  if (typeof value !== "string" || !COLOR.test(value)) throw new TypeError("Cor de perfil inválida.");
  return value.toLowerCase();
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Formato de ${label} inválido.`);
  return value as Record<string, unknown>;
}
