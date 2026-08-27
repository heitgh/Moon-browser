import type { DatabaseConnection } from "./connection.js";
export interface DatabaseTransaction extends DatabaseConnection { readonly active: boolean; commit(): Promise<void>; rollback(): Promise<void>; }
export async function withTransaction<T>(transaction: DatabaseTransaction, operation: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
  try { const result = await operation(transaction); await transaction.commit(); return result; }
  catch (error) { await transaction.rollback(); throw error; }
}
