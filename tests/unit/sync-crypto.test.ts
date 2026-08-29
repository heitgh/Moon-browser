import { describe, expect, it } from "vitest";
import { decryptSyncEnvelope, deriveUserKey, encryptSyncRecord, exportRecoveryKey, generateMasterKey, importRecoveryKey, unwrapMasterKey, wrapMasterKey } from "../../packages/sync/crypto.js";

describe("Moon sync E2EE", () => {
  it("keeps known plaintext out of envelopes and authenticates metadata", async () => {
    const master = generateMasterKey(); const secret = "SEGREDO-CONHECIDO-DO-MOON";
    const envelope = await encryptSyncRecord({ id: "note:one", category: "notes", logicalVersion: 1, deviceId: "device-a", updatedAt: 10, tombstone: false, payload: { content: secret } }, master);
    expect(JSON.stringify(envelope)).not.toContain(secret);
    await expect(decryptSyncEnvelope<{ content: string }>(envelope, master)).resolves.toMatchObject({ payload: { content: secret } });
    await expect(decryptSyncEnvelope({ ...envelope, category: "bookmarks" }, master)).rejects.toThrow();
  });

  it("separates the passphrase, wrapped master key and recovery key", async () => {
    const passphrase = "frase longa que nunca vai ao provider"; const master = generateMasterKey(); const derived = await deriveUserKey(passphrase);
    const wrapped = await wrapMasterKey(master, derived, "profile-a");
    expect(JSON.stringify(wrapped)).not.toContain(passphrase); expect(await unwrapMasterKey(wrapped, passphrase, "profile-a")).toEqual(master);
    await expect(unwrapMasterKey(wrapped, `${passphrase}!`, "profile-a")).rejects.toThrow();
    await expect(unwrapMasterKey(wrapped, passphrase, "profile-b")).rejects.toThrow();
    expect(importRecoveryKey(exportRecoveryKey(master))).toEqual(master);
  });

  it("uses a fresh nonce for each encryption", async () => {
    const master = generateMasterKey(); const record = { id: "settings:main", category: "settings" as const, logicalVersion: 1, deviceId: "device-a", updatedAt: 10, tombstone: false, payload: { accent: "#8b5cf6" } };
    const first = await encryptSyncRecord(record, master); const second = await encryptSyncRecord(record, master);
    expect(first.nonce).not.toBe(second.nonce); expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
