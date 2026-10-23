// Nexus Inc. — resolve once per hop and pin the TLS connection to that public IP.
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
  }
  // Conservative IPv6 global-unicast policy; excludes mapped, NAT64 and tunnels.
  if (isIP(address) !== 6) return false;
  const value = new URL(`http://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  return /^[23][0-9a-f]{3}:/.test(value) && !value.startsWith("2001::") && !/^2001:(?:0:|db8:|2:|1[0-9a-f]:|2[0-9a-f]:)/.test(value) && !value.startsWith("2002:") && !value.startsWith("3fff:");
}

export async function resolvePublicImage(url: URL): Promise<{ address: string; family: number }> {
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Images require public HTTPS on port 443");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (/(^|\.)(localhost|local|internal)$/.test(hostname.toLowerCase())) throw new Error("Local image hostname is not allowed");
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new Error("Private or special image destination is not allowed");
  return addresses[0]!;
}

export async function fetchPublicImage(input: string, types: ReadonlySet<string>, maxBytes: number, timeoutMs: number, maxRedirects: number): Promise<string> {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = new URL(input);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const pinned = await Promise.race([
      resolvePublicImage(url),
      new Promise<never>((_, reject) => { signal.addEventListener("abort", () => reject(new Error("Image download timed out")), { once: true }); })
    ]);
    signal.throwIfAborted();
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const req = request(url, {
        agent: false, signal, family: pinned.family,
        lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
        headers: { accept: [...types].join(",") }
      }, resolve);
      req.on("error", reject); req.end();
    });
    try {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const location = response.headers.location;
        if (!location || hop === maxRedirects) throw new Error("Too many image redirects");
        url = new URL(location, url); continue;
      }
      if (status < 200 || status >= 300) throw new Error(`Image request failed (${status})`);
      const mime = response.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
      if (!mime || !types.has(mime)) throw new Error("Unsupported image content type");
      if (Number(response.headers["content-length"] ?? 0) > maxBytes) throw new Error("Image is too large");
      const chunks: Buffer[] = []; let total = 0;
      for await (const chunk of response) {
        const bytes = Buffer.from(chunk); total += bytes.length;
        if (total > maxBytes) throw new Error("Image is too large");
        chunks.push(bytes);
      }
      signal.throwIfAborted();
      return `data:${mime};base64,${Buffer.concat(chunks).toString("base64")}`;
    } finally { response.destroy(); }
  }
  throw new Error("Image could not be loaded");
}
