// Nexus Inc. — progress and engine versions only; installer paths never leave main.
export interface NativeUpdateState {
  readonly phase: "idle" | "checking" | "downloading" | "downloaded" | "installing" | "error";
  readonly supported: boolean;
  readonly moon: string;
  readonly chromium: string;
  readonly electron: string;
  readonly version?: string;
  readonly percent?: number;
  readonly message?: string;
}
