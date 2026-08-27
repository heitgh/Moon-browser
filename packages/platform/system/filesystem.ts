import type { FileReadOptions, FilesystemPlatform, FileWriteOptions } from "../interfaces/filesystem-platform.js";
export class FilesystemService {
  constructor(readonly platform: FilesystemPlatform) {}
  exists(path: string) { return this.platform.exists(path); }
  stat(path: string) { return this.platform.stat(path); }
  read(path: string, options?: FileReadOptions) { return this.platform.readFile(path, options); }
  write(path: string, data: string | Uint8Array, options?: FileWriteOptions) { return this.platform.writeFile(path, data, options); }
  list(path: string) { return this.platform.readDirectory(path); }
  mkdir(path: string, recursive = true) { return this.platform.createDirectory(path, recursive); }
  copy(source: string, destination: string) { return this.platform.copy(source, destination); }
  move(source: string, destination: string) { return this.platform.move(source, destination); }
  async safeApplicationPath(...segments: string[]): Promise<string> { const root = await this.platform.getApplicationDataPath(); return this.platform.resolvePath(root, ...segments); }
}
