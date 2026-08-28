import type { SitePermissionDecision, SitePermissionKey, SitePermissionRecord } from "../../../../packages/ipc/site-permission-contract.js";

export interface SitePermissionPersistence {
  loadSitePermissions(): Promise<readonly SitePermissionRecord[]>;
  saveSitePermissions(records: readonly SitePermissionRecord[]): Promise<void>;
}

export class SitePermissionService {
  readonly #records = new Map<string, SitePermissionRecord>();
  #persistence: SitePermissionPersistence | undefined;

  async hydrate(persistence: SitePermissionPersistence): Promise<void> {
    this.#persistence = persistence;
    this.#records.clear();
    for (const record of await persistence.loadSitePermissions()) this.#records.set(key(record), record);
  }

  get(origin: string, permission: string): SitePermissionDecision | undefined { return this.#records.get(key({ origin, permission }))?.decision; }
  list(): readonly SitePermissionRecord[] { return [...this.#records.values()].sort((left, right) => right.updatedAt - left.updatedAt); }

  async set(origin: string, permission: string, decision: SitePermissionDecision): Promise<void> {
    const id = key({ origin, permission });
    const previous = this.#records.get(id);
    this.#records.set(id, { origin, permission, decision, updatedAt: Date.now() });
    try { await this.#persist(); }
    catch (error) { if (previous) this.#records.set(id, previous); else this.#records.delete(id); throw error; }
  }

  async clear(origin: string, permission: string): Promise<void> {
    const id = key({ origin, permission });
    const previous = this.#records.get(id);
    this.#records.delete(id);
    try { await this.#persist(); }
    catch (error) { if (previous) this.#records.set(id, previous); throw error; }
  }

  async clearOrigin(origin: string): Promise<void> {
    const removed = [...this.#records].filter(([, record]) => record.origin === origin);
    for (const [id] of removed) this.#records.delete(id);
    try { await this.#persist(); }
    catch (error) { for (const [id, record] of removed) this.#records.set(id, record); throw error; }
  }

  async #persist(): Promise<void> {
    if (!this.#persistence) throw new Error("Site permission persistence is not ready");
    await this.#persistence.saveSitePermissions(this.list());
  }
}

function key(value: SitePermissionKey): string { return `${value.origin}\0${value.permission}`; }
