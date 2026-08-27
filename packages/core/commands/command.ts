import type { CommandContext } from "./command-context.js";

export type CommandExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface Command<TInput = void, TResult = void> {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly keywords?: readonly string[];

  canExecute?(
    context: CommandContext,
    input: TInput
  ): boolean | Promise<boolean>;

  execute(
    context: CommandContext,
    input: TInput
  ): TResult | Promise<TResult>;
}

export interface CommandExecution<TResult = unknown> {
  readonly id: string;
  readonly commandId: string;
  readonly status: CommandExecutionStatus;
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly result?: TResult;
  readonly error?: unknown;
}
