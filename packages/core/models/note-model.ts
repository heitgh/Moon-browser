export type NoteFormat = "plain-text" | "markdown";

export interface NoteModel {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly format: NoteFormat;
  readonly pinned: boolean;
  readonly archived: boolean;
  readonly tags: readonly string[];
  readonly sourceUrl?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type CreateNoteInput = Omit<
  NoteModel,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateNoteInput = Partial<
  Omit<NoteModel, "id" | "createdAt" | "updatedAt">
>;
