import { MoonError } from "../errors/moon-error.js";
import type { CommandContext } from "./command-context.js";
import type { CommandExecution } from "./command.js";
import { CommandRegistry } from "./command-registry.js";

export class CommandManager {
  #nextExecutionId = 0;

  constructor(
    readonly registry: CommandRegistry = new CommandRegistry()
  ) {}

  async execute<TInput, TResult>(
    commandId: string,
    context: CommandContext,
    input: TInput
  ): Promise<CommandExecution<TResult>> {
    const command = this.registry.get<TInput, TResult>(commandId);

    if (!command) {
      throw new MoonError(
        "COMMAND_NOT_FOUND",
        `Command not found: ${commandId}`,
        { context: { commandId }, recoverable: true }
      );
    }

    if (context.signal?.aborted) {
      return this.#cancelledExecution<TResult>(commandId);
    }

    const canExecute = await command.canExecute?.(context, input) ?? true;

    if (!canExecute) {
      throw new MoonError(
        "COMMAND_NOT_AVAILABLE",
        `Command cannot execute in the current context: ${commandId}`,
        { context: { commandId }, recoverable: true }
      );
    }

    const id = `command-execution-${++this.#nextExecutionId}`;
    const startedAt = Date.now();

    await context.eventBus.publish(
      "command:started",
      { id, commandId, startedAt },
      { source: { type: "core", id: "command-manager" } }
    );

    try {
      const result = await command.execute(context, input);
      const execution: CommandExecution<TResult> = {
        id,
        commandId,
        status: "completed",
        startedAt,
        completedAt: Date.now(),
        result
      };

      await context.eventBus.publish("command:completed", execution, {
        source: { type: "core", id: "command-manager" }
      });

      return execution;
    } catch (error) {
      const execution: CommandExecution<TResult> = {
        id,
        commandId,
        status: context.signal?.aborted ? "cancelled" : "failed",
        startedAt,
        completedAt: Date.now(),
        error
      };

      await context.eventBus.publish("command:failed", execution, {
        source: { type: "core", id: "command-manager" }
      });

      return execution;
    }
  }

  #cancelledExecution<TResult>(
    commandId: string
  ): CommandExecution<TResult> {
    const timestamp = Date.now();

    return {
      id: `command-execution-${++this.#nextExecutionId}`,
      commandId,
      status: "cancelled",
      startedAt: timestamp,
      completedAt: timestamp
    };
  }
}
