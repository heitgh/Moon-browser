import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  showOpenDialog: vi.fn(),
  createFromBuffer: vi.fn(),
}));
vi.mock("electron", () => ({
  dialog: { showOpenDialog: electron.showOpenDialog },
  nativeImage: { createFromBuffer: electron.createFromBuffer },
}));

import { WallpaperLibraryService } from "../../apps/desktop/electron/services/wallpaper-library-service.js";

const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const directories: string[] = [];
afterEach(async () => {
  vi.resetAllMocks();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function importFixture(width: number, height: number, empty = false) {
  const directory = await mkdtemp(join(tmpdir(), "moon-wallpaper-"));
  directories.push(directory);
  const path = join(directory, "sample.png");
  await writeFile(path, pngHeader);
  electron.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [path] });
  electron.createFromBuffer.mockReturnValue({
    isEmpty: () => empty,
    getSize: () => ({ width, height }),
    resize: vi.fn(() => ({ toDataURL: () => "data:image/png;base64,dGh1bWI=" })),
  });
  const storage = { listWallpapers: vi.fn(async () => []), saveWallpaper: vi.fn(async () => undefined) };
  const service = new WallpaperLibraryService(storage as unknown as ConstructorParameters<typeof WallpaperLibraryService>[0]);
  return { storage, service };
}

describe("wallpaper library import", () => {
  it("stores a decoded image with a small thumbnail", async () => {
    const { service, storage } = await importFixture(1920, 1080);
    const item = await service.importFromDialog();
    expect(item?.thumbnailData).toBe("data:image/png;base64,dGh1bWI=");
    expect(storage.saveWallpaper).toHaveBeenCalledOnce();
  });

  it("rejects oversized or undecodable files before writing the profile", async () => {
    for (const [width, height, empty] of [[8193, 100, false], [1920, 1080, true]] as const) {
      const { service, storage } = await importFixture(width, height, empty);
      await expect(service.importFromDialog()).rejects.toThrow(/decodificado|megapixels/);
      expect(storage.saveWallpaper).not.toHaveBeenCalled();
    }
  });

  it("bounds both dimensions of an extreme portrait thumbnail", async () => {
    const { service } = await importFixture(1, 8192);
    await service.importFromDialog();
    const image = electron.createFromBuffer.mock.results[0]?.value;
    expect(image.resize).toHaveBeenCalledWith({ width: 1, height: 320, quality: "good" });
  });
});
