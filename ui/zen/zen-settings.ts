export interface ZenSettings { readonly hideToolbar: boolean; readonly hideSidebar: boolean; readonly dimInactive: boolean; readonly enterFullscreen: boolean; readonly escapeToExit: boolean; }
export const DEFAULT_ZEN_SETTINGS: ZenSettings = { hideToolbar: true, hideSidebar: true, dimInactive: false, enterFullscreen: false, escapeToExit: true };
