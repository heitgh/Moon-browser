// Nexus Inc. — never substitute an embedding page for an unknown requesting frame.
export function permissionOrigin(value: string | undefined): string | undefined {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.origin : undefined;
  } catch { return undefined; }
}
export function permissionRequestOrigin(details: { readonly requestingUrl?: string }): string | undefined {
  return permissionOrigin(details.requestingUrl);
}
