import type { DownloadItem, DownloadPlatform, DownloadProgress, DownloadRequest, DownloadState } from "../interfaces/download-platform.js";
export class DownloadService {
  constructor(readonly platform: DownloadPlatform) {}
  start(request: DownloadRequest): Promise<DownloadItem> { return this.platform.start(request); }
  pause(id: string): Promise<void> { return this.platform.pause(id); }
  resume(id: string): Promise<void> { return this.platform.resume(id); }
  cancel(id: string): Promise<void> { return this.platform.cancel(id); }
  retry(id: string): Promise<DownloadItem> { return this.platform.retry(id); }
  get(id: string): Promise<DownloadItem | null> { return this.platform.get(id); }
  list(state?: DownloadState): Promise<readonly DownloadItem[]> { return this.platform.list({ state }); }
  progress(id: string): Promise<DownloadProgress | null> { return this.platform.getProgress(id); }
  open(id: string): Promise<void> { return this.platform.openFile(id); }
  reveal(id: string): Promise<void> { return this.platform.showInFolder(id); }
}
