import type { DatabaseConnection } from "./connection.js";
export interface DatabaseMigration { readonly version: number; readonly name: string; up(connection: DatabaseConnection): Promise<void>; down?(connection: DatabaseConnection): Promise<void>; }
export interface AppliedMigration { readonly version: number; readonly name: string; readonly appliedAt: number; }
export function sortMigrations(migrations: readonly DatabaseMigration[]): readonly DatabaseMigration[] { return [...migrations].sort((a, b) => a.version - b.version); }
