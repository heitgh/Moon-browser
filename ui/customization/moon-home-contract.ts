import { createDefaultCustomization, validateCustomization, type HomeSettings } from "./customization-schema.js";

export const MOON_HOME_FORMAT = "moon-home" as const;
export const MOON_HOME_VERSION = 1 as const;
const MAX_MOON_HOME_BYTES = 512_000;

export function serializeMoonHome(home: HomeSettings): string {
  const validated = validateHome(home);
  return JSON.stringify({ format: MOON_HOME_FORMAT, version: MOON_HOME_VERSION, home: validated }, null, 2);
}

export function parseMoonHome(content: string): HomeSettings {
  if (new TextEncoder().encode(content).byteLength > MAX_MOON_HOME_BYTES) throw new Error("O arquivo .moonhome excede 512 KB.");
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error("O arquivo .moonhome não contém JSON válido."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Pacote .moonhome inválido.");
  const root = parsed as Record<string, unknown>;
  if (root.format !== MOON_HOME_FORMAT || root.version !== MOON_HOME_VERSION) throw new Error("Versão .moonhome não suportada.");
  if (Object.keys(root).some(key => !["format", "version", "home"].includes(key))) throw new Error("Campo não permitido no pacote .moonhome.");
  return validateHome(root.home);
}

function validateHome(home: unknown): HomeSettings {
  const defaults = createDefaultCustomization();
  return validateCustomization({ ...defaults, global: { ...defaults.global, home } }).global.home;
}
