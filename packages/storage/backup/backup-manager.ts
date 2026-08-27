export interface BackupDescriptor { readonly id: string; readonly path: string; readonly createdAt: number; readonly size: number; readonly version: number; }
export interface BackupAdapter { create(destination: string): Promise<BackupDescriptor>; list(): Promise<readonly BackupDescriptor[]>; remove(id: string): Promise<void>; }
export class BackupManager { constructor(readonly adapter: BackupAdapter) {} create(destination: string) { return this.adapter.create(destination); } list() { return this.adapter.list(); } remove(id: string) { return this.adapter.remove(id); } }
