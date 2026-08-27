import type { Command } from "./command.js";

export class CommandRegistry {
  readonly #commands = new Map<string, Command<unknown, unknown>>();

  register<TInput, TResult>(
    command: Command<TInput, TResult>
  ): () => void {
    if (this.#commands.has(command.id)) {
      throw new Error(`Command already registered: ${command.id}`);
    }

    this.#commands.set(
      command.id,
      command as Command<unknown, unknown>
    );

    return () => {
      this.unregister(command.id);
    };
  }

  unregister(commandId: string): boolean {
    return this.#commands.delete(commandId);
  }

  get<TInput = unknown, TResult = unknown>(
    commandId: string
  ): Command<TInput, TResult> | undefined {
    return this.#commands.get(commandId) as
      | Command<TInput, TResult>
      | undefined;
  }

  has(commandId: string): boolean {
    return this.#commands.has(commandId);
  }

  list(): readonly Command<unknown, unknown>[] {
    return [...this.#commands.values()];
  }

  search(query: string): readonly Command<unknown, unknown>[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return this.list();
    }

    return this.list().filter(command => {
      const searchableText = [
        command.id,
        command.title,
        command.description,
        command.category,
        ...(command.keywords ?? [])
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLocaleLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }

  clear(): void {
    this.#commands.clear();
  }
}
