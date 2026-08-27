export type FileType =
  | "file"
  | "directory"
  | "symlink"
  | "unknown";

export interface FileMetadata {
  readonly path: string;
  readonly type: FileType;
  readonly size: number;
  readonly createdAt: number;
  readonly modifiedAt: number;
  readonly accessedAt: number;
  readonly readonly: boolean;
}

export interface FileReadOptions {
  readonly encoding?: "utf-8" | "base64" | "binary";
  readonly maxBytes?: number;
}

export interface FileWriteOptions {
  readonly encoding?: "utf-8" | "base64" | "binary";
  readonly overwrite?: boolean;
  readonly createDirectories?: boolean;
}

export interface DirectoryEntry {
  readonly name: string;
  readonly path: string;
  readonly type: FileType;
}

export interface FilesystemPlatform {
  exists(
    path: string
  ): Promise<boolean>;

  stat(
    path: string
  ): Promise<FileMetadata>;

  readFile(
    path: string,
    options?: FileReadOptions
  ): Promise<string | Uint8Array>;

  writeFile(
    path: string,
    data: string | Uint8Array,
    options?: FileWriteOptions
  ): Promise<void>;

  deleteFile(
    path: string
  ): Promise<void>;

  createDirectory(
    path: string,
    recursive?: boolean
  ): Promise<void>;

  deleteDirectory(
    path: string,
    recursive?: boolean
  ): Promise<void>;

  readDirectory(
    path: string
  ): Promise<readonly DirectoryEntry[]>;

  copy(
    source: string,
    destination: string
  ): Promise<void>;

  move(
    source: string,
    destination: string
  ): Promise<void>;

  resolvePath(
    ...segments: string[]
  ): Promise<string>;

  getApplicationDataPath(): Promise<string>;

  getUserDataPath(): Promise<string>;

  getDownloadsPath(): Promise<string>;

  getCachePath(): Promise<string>;

  getTemporaryPath(): Promise<string>;
}