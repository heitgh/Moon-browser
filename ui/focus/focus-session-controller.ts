import { ZenController } from "../zen/zen-controller.js";
import { ZenMode } from "../zen/zen-mode.js";

export const FOCUS_STORAGE_KEY = "moon:focus:session:v1";
export const FOCUS_SUMMARIES_KEY = "moon:focus:summaries:v1";

export type FocusMode = "timed" | "pomodoro" | "continuous" | "until";
export type FocusPreset = "study" | "reading" | "writing" | "research" | "programming" | "custom";
export type FocusStatus = "active" | "paused";
export type FocusPhase = "focus" | "break";

export interface FocusSessionOptions {
  readonly mode: FocusMode;
  readonly preset: FocusPreset;
  readonly durationMinutes: number;
  readonly breakMinutes: number;
  readonly cycles: number;
  readonly until?: number;
  readonly alert: boolean;
  readonly allowedHosts: readonly string[];
  readonly workspaceIds: readonly string[];
}

export interface FocusSessionState extends FocusSessionOptions {
  readonly status: FocusStatus;
  readonly phase: FocusPhase;
  readonly startedAt: number;
  readonly phaseStartedAt: number;
  readonly phaseEndsAt?: number;
  readonly pausedRemainingMs?: number;
  readonly completedCycles: number;
  readonly interruptions: number;
  readonly focusedElapsedMs: number;
}

export interface FocusSummary {
  readonly startedAt: number;
  readonly endedAt: number;
  readonly focusedMs: number;
  readonly preset: FocusPreset;
  readonly completedCycles: number;
  readonly interruptions: number;
  readonly chosenHosts: readonly string[];
}

type Listener = (state: FocusSessionState | null) => void;

export class FocusSessionController {
  readonly #listeners = new Set<Listener>();
  readonly #zen: ZenController;
  #state: FocusSessionState | null;
  #timer: number | undefined;

  constructor(readonly root: HTMLElement, readonly storage?: Storage, readonly onAlert: (message: string) => void = () => undefined) {
    this.#zen = new ZenController(new ZenMode(root));
    this.#state = storage ? parseState(storage.getItem(FOCUS_STORAGE_KEY)) : null;
    if (this.#state) { void this.#zen.enter(); this.#startTimer(); this.#tick(); }
  }

  get state(): FocusSessionState | null { return this.#state ? structuredClone(this.#state) : null; }
  get active(): boolean { return this.#state !== null; }

  subscribe(listener: Listener): () => void { this.#listeners.add(listener); listener(this.state); return () => this.#listeners.delete(listener); }

  start(options: FocusSessionOptions): void {
    if (this.#state) this.end(false);
    const now = Date.now(); const normalized = normalizeOptions(options); const duration = normalized.mode === "until" ? Math.max(1_000, (normalized.until ?? now + 25 * 60_000) - now) : normalized.durationMinutes * 60_000;
    this.#state = { ...normalized, status: "active", phase: "focus", startedAt: now, phaseStartedAt: now, ...(normalized.mode === "continuous" ? {} : { phaseEndsAt: now + duration }), completedCycles: 0, interruptions: 0, focusedElapsedMs: 0 };
    this.#persist(); void this.#zen.enter(); this.#startTimer(); this.#emit();
  }

  pause(): void { const state = this.#state; if (!state || state.status === "paused") return; const now = Date.now(); this.#state = { ...state, status: "paused", focusedElapsedMs: state.focusedElapsedMs + (state.phase === "focus" ? Math.max(0, now - state.phaseStartedAt) : 0), ...(state.phaseEndsAt ? { pausedRemainingMs: Math.max(0, state.phaseEndsAt - now) } : {}), phaseEndsAt: undefined }; this.#persist(); this.#emit(); }
  resume(): void { const state = this.#state; if (!state || state.status !== "paused") return; const now = Date.now(); this.#state = { ...state, status: "active", phaseStartedAt: now, ...(state.pausedRemainingMs === undefined ? {} : { phaseEndsAt: now + state.pausedRemainingMs }), pausedRemainingMs: undefined }; this.#persist(); this.#emit(); }
  extend(minutes = 5): void { const state = this.#state; if (!state || state.mode === "continuous") return; const delta = clamp(minutes, 1, 120) * 60_000; if (state.status === "paused") this.#state = { ...state, pausedRemainingMs: (state.pausedRemainingMs ?? 0) + delta }; else this.#state = { ...state, phaseEndsAt: (state.phaseEndsAt ?? Date.now()) + delta }; this.#persist(); this.#emit(); }
  interrupt(): void { if (!this.#state) return; this.#state = { ...this.#state, interruptions: this.#state.interruptions + 1 }; this.#persist(); this.#emit(); }

  isAllowed(rawUrl: string, workspaceId?: string): boolean {
    const state = this.#state; if (!state) return true;
    if (workspaceId && state.workspaceIds.length && !state.workspaceIds.includes(workspaceId)) return false;
    if (!state.allowedHosts.length || rawUrl.startsWith("moon://")) return true;
    try { const host = new URL(rawUrl).hostname.toLocaleLowerCase(); return state.allowedHosts.some(candidate => host === candidate || host.endsWith(`.${candidate}`)); } catch { return true; }
  }

  remainingMs(now = Date.now()): number | null { const state = this.#state; if (!state || state.mode === "continuous") return null; if (state.status === "paused") return state.pausedRemainingMs ?? 0; return Math.max(0, (state.phaseEndsAt ?? now) - now); }

  end(saveSummary = true): FocusSummary | null {
    const state = this.#state; if (!state) return null; const endedAt = Date.now(); const focusedMs = state.focusedElapsedMs + (state.status === "active" && state.phase === "focus" ? Math.max(0, endedAt - state.phaseStartedAt) : 0); const summary: FocusSummary = { startedAt: state.startedAt, endedAt, focusedMs, preset: state.preset, completedCycles: state.completedCycles, interruptions: state.interruptions, chosenHosts: state.allowedHosts };
    this.#state = null; if (this.#timer !== undefined) window.clearInterval(this.#timer); this.#timer = undefined; this.storage?.removeItem(FOCUS_STORAGE_KEY); if (saveSummary) this.#saveSummary(summary); void this.#zen.exit(); this.#emit(); return summary;
  }

  dispose(): void { if (this.#timer !== undefined) window.clearInterval(this.#timer); this.#zen.stop(); this.#listeners.clear(); }

  #startTimer(): void { if (this.#timer !== undefined) return; this.#timer = window.setInterval(() => this.#tick(), 1_000); }
  #tick(): void {
    const state = this.#state; if (!state || state.status === "paused") return;
    if (!state.phaseEndsAt || Date.now() < state.phaseEndsAt) { this.#emit(); return; }
    if (state.mode !== "pomodoro") { if (state.alert) this.onAlert("Sessão de foco concluída."); this.end(); return; }
    const now = Date.now();
    if (state.phase === "focus") {
      const completedCycles = state.completedCycles + 1;
      if (completedCycles >= state.cycles) { if (state.alert) this.onAlert("Ciclos de foco concluídos."); this.end(); return; }
      this.#state = { ...state, phase: "break", phaseStartedAt: now, phaseEndsAt: now + state.breakMinutes * 60_000, completedCycles, focusedElapsedMs: state.focusedElapsedMs + Math.max(0, now - state.phaseStartedAt) };
      if (state.alert) this.onAlert("Hora da pausa.");
    } else {
      this.#state = { ...state, phase: "focus", phaseStartedAt: now, phaseEndsAt: now + state.durationMinutes * 60_000 };
      if (state.alert) this.onAlert("Novo ciclo de foco iniciado.");
    }
    this.#persist(); this.#emit();
  }

  #persist(): void { if (!this.storage) return; if (this.#state) this.storage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(this.#state)); else this.storage.removeItem(FOCUS_STORAGE_KEY); }
  #saveSummary(summary: FocusSummary): void { if (!this.storage) return; const previous = parseSummaries(this.storage.getItem(FOCUS_SUMMARIES_KEY)); this.storage.setItem(FOCUS_SUMMARIES_KEY, JSON.stringify([summary, ...previous].slice(0, 20))); }
  #emit(): void { const value = this.state; this.#listeners.forEach(listener => listener(value)); }
}

function normalizeOptions(value: FocusSessionOptions): FocusSessionOptions {
  const allowedHosts = [...new Set(value.allowedHosts.map(host => host.trim().toLocaleLowerCase()).filter(host => /^(?:[a-z0-9-]+\.)*[a-z0-9-]+$/.test(host)))].slice(0, 100);
  const workspaceIds = [...new Set(value.workspaceIds.filter(id => /^[a-z0-9-]{1,100}$/i.test(id)))].slice(0, 100);
  return { mode: value.mode, preset: value.preset, durationMinutes: clamp(value.durationMinutes, 1, 240), breakMinutes: clamp(value.breakMinutes, 1, 60), cycles: clamp(value.cycles, 1, 12), ...(value.until === undefined ? {} : { until: Math.max(Date.now() + 1_000, value.until) }), alert: value.alert, allowedHosts, workspaceIds };
}
function parseState(raw: string | null): FocusSessionState | null { if (!raw) return null; try { const value = JSON.parse(raw) as FocusSessionState; if (!value || !["timed", "pomodoro", "continuous", "until"].includes(value.mode) || !["active", "paused"].includes(value.status) || !["focus", "break"].includes(value.phase) || !Number.isFinite(value.startedAt)) return null; return { ...normalizeOptions(value), status: value.status, phase: value.phase, startedAt: value.startedAt, phaseStartedAt: Number.isFinite(value.phaseStartedAt) ? value.phaseStartedAt : value.startedAt, ...(Number.isFinite(value.phaseEndsAt) ? { phaseEndsAt: value.phaseEndsAt } : {}), ...(Number.isFinite(value.pausedRemainingMs) ? { pausedRemainingMs: value.pausedRemainingMs } : {}), completedCycles: clamp(value.completedCycles, 0, 12), interruptions: clamp(value.interruptions, 0, 1_000_000), focusedElapsedMs: Number.isFinite(value.focusedElapsedMs) ? Math.max(0, value.focusedElapsedMs) : 0 }; } catch { return null; } }
function parseSummaries(raw: string | null): readonly FocusSummary[] { if (!raw) return []; try { const value = JSON.parse(raw); return Array.isArray(value) ? value.filter(item => item && typeof item === "object").slice(0, 20) as FocusSummary[] : []; } catch { return []; } }
function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, Math.round(Number.isFinite(value) ? value : minimum))); }
