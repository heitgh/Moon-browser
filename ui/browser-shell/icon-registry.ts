const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const ALLOWED_ELEMENTS = new Set(["g", "path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]);
const ALLOWED_ATTRIBUTES = new Set(["d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "transform"]);

export class IconRegistry<Name extends string> {
  readonly #overrides = new Map<Name, readonly Element[]>();
  readonly #nodes = new Set<SVGSVGElement>();

  constructor(readonly builtins: Readonly<Record<Name, string>>) {}

  create(name: Name, className = "moon-icon"): SVGSVGElement {
    const node = document.createElementNS(SVG_NAMESPACE, "svg");
    node.setAttribute("viewBox", "0 0 24 24"); node.setAttribute("aria-hidden", "true"); node.dataset.moonIcon = name; node.classList.add(...className.split(" "));
    this.#nodes.add(node); this.#render(node, name); return node;
  }

  install(overrides: Readonly<Partial<Record<Name, string>>>): void {
    const validated = new Map<Name, readonly Element[]>();
    for (const [name, source] of Object.entries(overrides) as [Name, string | undefined][]) {
      if (!(name in this.builtins) || source === undefined) throw new Error("Identidade de ícone não permitida.");
      validated.set(name, sanitizeSvg(source));
    }
    for (const [name, nodes] of validated) this.#overrides.set(name, nodes);
    this.#refresh();
  }

  clear(names?: readonly Name[]): void {
    if (names) names.forEach(name => this.#overrides.delete(name)); else this.#overrides.clear();
    this.#refresh();
  }

  #refresh(): void {
    for (const node of this.#nodes) { if (!node.isConnected) { this.#nodes.delete(node); continue; } const name = node.dataset.moonIcon as Name | undefined; if (name) this.#render(node, name); }
  }

  #render(node: SVGSVGElement, name: Name): void {
    const custom = this.#overrides.get(name);
    if (custom) node.replaceChildren(...custom.map(child => child.cloneNode(true)));
    else node.innerHTML = this.builtins[name];
  }
}

function sanitizeSvg(input: string): readonly Element[] {
  if (input.length > 32_768 || input.includes("\0")) throw new Error("SVG de ícone excede o limite seguro.");
  let source = input;
  const dataMatch = /^data:image\/svg\+xml;base64,([a-z0-9+/=]+)$/i.exec(input);
  if (dataMatch) { try { source = atob(dataMatch[1]!); } catch { throw new Error("SVG de ícone inválido."); } }
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml"); const root = parsed.documentElement;
  if (root.localName !== "svg" || parsed.querySelector("parsererror")) throw new Error("SVG de ícone inválido.");
  const descendants = [...root.querySelectorAll("*")]; if (descendants.length === 0 || descendants.length > 128) throw new Error("Estrutura SVG de ícone inválida.");
  for (const element of descendants) {
    if (!ALLOWED_ELEMENTS.has(element.localName)) throw new Error(`Elemento SVG não permitido: ${element.localName}.`);
    for (const attribute of [...element.attributes]) {
      if (!ALLOWED_ATTRIBUTES.has(attribute.name) || /url\s*\(|javascript:|data:|https?:/i.test(attribute.value)) throw new Error(`Atributo SVG não permitido: ${attribute.name}.`);
    }
  }
  return [...root.children].map(child => document.importNode(child, true));
}
