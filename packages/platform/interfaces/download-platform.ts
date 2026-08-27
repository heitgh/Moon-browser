export type DownloadState =
  | "pending"
  | "in-progress"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export interface DownloadRequest {
  readonly id: string;
  readonly url: string;
  readonly filename?: string;
  readonly destination?: string;
  readonly tabId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface DownloadProgress {
  readonly id: string;
  readonly state: DownloadState;
  readonly receivedBytes: number;
  readonly totalBytes?: number;
  readonly speedBytesPerSecond?: number;
  readonly percentage?: number;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly error?: string;
}

export interface DownloadItem extends DownloadRequest {
  readonly state: DownloadState;
  readonly receivedBytes: number;
  readonly totalBytes?: number;
  readonly savePath?: string;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly error?: string;
}

export interface DownloadPlatform {
  start(
    request: DownloadRequest
  ): Promise<DownloadItem>;

  pause(
    downloadId: string
  ): Promise<void>;

  resume(
    downloadId: string
  ): Promise<void>;

  cancel(
    downloadId: string
  ): Promise<void>;

  retry(
    downloadId: string
  ): Promise<DownloadItem>;

  get(
    downloadId: string
  ): Promise<DownloadItem | null>;

  list(
    options?: {
      readonly state?: DownloadState;
      readonly limit?: number;
    }
  ): Promise<readonly DownloadItem[]>;

  getProgress(
    downloadId: string
  ): Promise<DownloadProgress | null>;

  remove(
    downloadId: string
  ): Promise<void>;

  openFile(
    downloadId: string
  ): Promise<void>;

  showInFolder(
    downloadId: string
  ): Promise<void>;

  clearHistory(): Promise<void>;

  shutdown(): Promise<void>;
}