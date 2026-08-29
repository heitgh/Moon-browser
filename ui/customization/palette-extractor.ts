import type { ThemeColors, ThemeRegions } from "./customization-schema.js";

export interface ExtractedPalette {
  readonly colors: Pick<ThemeColors, "background" | "surface" | "elevated" | "text" | "textMuted" | "accent" | "border">;
  readonly regions: ThemeRegions;
}

export function extractPalette(data: ImageData): ExtractedPalette {
  const bins = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let index = 0; index < data.data.length; index += 4) {
    if ((data.data[index + 3] ?? 0) < 160) continue;
    const r = data.data[index] ?? 0; const g = data.data[index + 1] ?? 0; const b = data.data[index + 2] ?? 0;
    const key = `${r >> 4}:${g >> 4}:${b >> 4}`; const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }; bin.count += 1; bin.r += r; bin.g += g; bin.b += b; bins.set(key, bin);
  }
  if (!bins.size) throw new Error("A imagem não possui pixels opacos suficientes para extrair uma paleta.");
  const colors = [...bins.values()].map(bin => { const rgb = [Math.round(bin.r / bin.count), Math.round(bin.g / bin.count), Math.round(bin.b / bin.count)] as const; return { count: bin.count, rgb, luminance: luminance(rgb), vibrance: vibrance(rgb) }; }).sort((left, right) => right.count - left.count);
  const candidates = colors.slice(0, 24); const backgroundRgb = [...candidates].sort((left, right) => left.luminance - right.luminance || right.count - left.count)[0]!.rgb;
  const accentRgb = [...candidates].sort((left, right) => right.vibrance * Math.log2(right.count + 1) - left.vibrance * Math.log2(left.count + 1))[0]!.rgb;
  const background = hex(backgroundRgb); const surface = hex(mix(backgroundRgb, [255, 255, 255], .08)); const elevated = hex(mix(backgroundRgb, [255, 255, 255], .14)); const textRgb = luminance(backgroundRgb) < .42 ? [245, 247, 252] as const : [15, 18, 24] as const; const text = hex(textRgb); const textMuted = hex(mix(textRgb, backgroundRgb, .42)); const accent = hex(accentRgb); const border = hex(mix(backgroundRgb, textRgb, .18));
  return { colors: { background, surface, elevated, text, textMuted, accent, border }, regions: { toolbar: surface, tabs: surface, sidebar: background, home: background, content: background, selection: accent } };
}

function mix(left: readonly number[], right: readonly number[], ratio: number): readonly [number, number, number] { return [0, 1, 2].map(index => Math.round((left[index] ?? 0) * (1 - ratio) + (right[index] ?? 0) * ratio)) as unknown as readonly [number, number, number]; }
function hex(rgb: readonly number[]): string { return `#${rgb.map(value => value.toString(16).padStart(2, "0")).join("")}`; }
function luminance(rgb: readonly number[]): number { const channels = rgb.map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }); return .2126 * channels[0]! + .7152 * channels[1]! + .0722 * channels[2]!; }
function vibrance(rgb: readonly number[]): number { return (Math.max(...rgb) - Math.min(...rgb)) / 255; }
