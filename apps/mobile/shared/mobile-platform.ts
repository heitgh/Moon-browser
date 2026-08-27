import type { Platform } from "@moon/platform";
export interface MobilePlatformMetadata { readonly name: string; readonly version: string; readonly os: "android" | "ios"; readonly architecture: string; }
export function createMobilePlatform(capabilities: Omit<Platform, "name" | "version" | "type" | "os" | "architecture">, metadata: MobilePlatformMetadata): Platform { return { ...capabilities, ...metadata, type: "mobile" }; }
