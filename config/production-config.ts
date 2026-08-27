import { DEFAULT_CONFIG,type MoonConfig } from "./default-config.js";
export const PRODUCTION_CONFIG:MoonConfig={...DEFAULT_CONFIG,environment:"production",logLevel:"info",autoUpdate:false};
