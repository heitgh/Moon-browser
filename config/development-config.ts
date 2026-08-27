import { DEFAULT_CONFIG,type MoonConfig } from "./default-config.js";
export const DEVELOPMENT_CONFIG:MoonConfig={...DEFAULT_CONFIG,environment:"development",logLevel:"debug",autoUpdate:false};
