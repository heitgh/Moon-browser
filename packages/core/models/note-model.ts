export type NoteFormat = "plain-text" | "markdown";

export interface NoteVersion {
  readonly revision: number;
  readonly title: string;
  readonly content: string;
  readonly updatedAt: number;
}

export interface NoteModel {
  readonly id: string;
  readonly kind?: "note" | "folder";
  readonly parentId?: string;
  readonly title: string;
  readonly content: string;
  readonly format: NoteFormat;
  readonly pinned: boolean;
  readonly favorite?: boolean;
  readonly archived: boolean;
  readonly deletedAt?: number;
  readonly tags: readonly string[];
  readonly sourceUrl?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly revision?: number;
  readonly versions?: readonly NoteVersion[];
}

export type CreateNoteInput = Omit<
  NoteModel,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateNoteInput = Partial<
  Omit<NoteModel, "id" | "createdAt" | "updatedAt">
>;
