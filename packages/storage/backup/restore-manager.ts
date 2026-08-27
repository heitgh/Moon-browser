import type { BackupDescriptor } from "./backup-manager.js";
export interface RestoreOptions { readonly overwrite?: boolean; readonly verifyIntegrity?: boolean; }
export interface RestoreAdapter { verify(backup: BackupDescriptor): Promise<boolean>; restore(backup: BackupDescriptor, options?: RestoreOptions): Promise<void>; }
export class RestoreManager { constructor(readonly adapter: RestoreAdapter) {} async restore(backup: BackupDescriptor, options: RestoreOptions = {}): Promise<void> { if ((options.verifyIntegrity ?? true) && !(await this.adapter.verify(backup))) throw new Error(`Backup integrity check failed: ${backup.id}`); await this.adapter.restore(backup, options); } }
