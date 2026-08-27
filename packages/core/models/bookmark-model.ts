export interface BookmarkModel {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly description?: string;
  readonly faviconUrl?: string;
  readonly folderId?: string;
  readonly workspaceId?: string;
  readonly tags: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface BookmarkFolderModel {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string;
  readonly workspaceId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type CreateBookmarkInput = Omit<
  BookmarkModel,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateBookmarkInput = Partial<
  Omit<BookmarkModel, "id" | "createdAt" | "updatedAt">
>;
