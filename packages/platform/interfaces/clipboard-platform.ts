export type ClipboardFormat =
  | "text"
  | "html"
  | "image"
  | "files";

export interface ClipboardContent {
  readonly format: ClipboardFormat;
  readonly data: string | Uint8Array | readonly string[];
}

export interface ClipboardPlatform {
  readText(): Promise<string>;

  writeText(
    text: string
  ): Promise<void>;

  read(
    format: ClipboardFormat
  ): Promise<ClipboardContent | null>;

  write(
    content: ClipboardContent
  ): Promise<void>;

  has(
    format: ClipboardFormat
  ): Promise<boolean>;

  clear(): Promise<void>;
}