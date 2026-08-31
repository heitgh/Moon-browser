import { describe, expect, it } from "vitest";
import { LocalCredentialVault, MemorySecureSecretBackend, MemoryVaultRepository, UnavailableSecretBackend, normalizeCredentialOrigin } from "../../packages/security/credential-vault.js";

describe("LocalCredentialVault", () => {
  it("stays unavailable when the OS secret backend is missing", () => {
    const vault = new LocalCredentialVault(new UnavailableSecretBackend("Secret Service indisponível no Linux."), new MemoryVaultRepository());
    expect(vault.status).toMatchObject({ available: false, locked: true, captureEnabled: false, autofillEnabled: false });
    expect(() => vault.unlock(true)).toThrow(/indisponível/i);
  });

  it("seals passwords, requires conscious reveal and enforces exact origin", async () => {
    const repository = new MemoryVaultRepository(); const vault = new LocalCredentialVault(await MemorySecureSecretBackend.create(), repository); vault.unlock(true);
    await vault.save({ id: "credential-one", origin: "https://example.com", username: "moon", password: "PASSWORD-NAO-PODE-VAZAR" }, true);
    expect(JSON.stringify(repository.snapshot())).not.toContain("PASSWORD-NAO-PODE-VAZAR");
    await expect(vault.reveal("credential-one", "https://evil.example", true)).rejects.toThrow(/origem diferente/i);
    await expect(vault.reveal("credential-one", "https://example.com", false)).rejects.toThrow(/interação/i);
    await expect(vault.reveal("credential-one", "https://example.com", true)).resolves.toMatchObject({ username: "moon", password: "PASSWORD-NAO-PODE-VAZAR" });
  });

  it("locks automatically and rejects ambiguous origins", async () => {
    let now = 1; const vault = new LocalCredentialVault(await MemorySecureSecretBackend.create(), new MemoryVaultRepository(), 10_000, () => now); vault.unlock(true); now += 10_001;
    await expect(vault.list()).rejects.toThrow(/bloqueado/i); expect(vault.status.locked).toBe(true);
    expect(normalizeCredentialOrigin("https://example.com")).toBe("https://example.com");
    expect(() => normalizeCredentialOrigin("http://example.com")).toThrow(); expect(() => normalizeCredentialOrigin("https://example.com/login")).toThrow();
  });
});
