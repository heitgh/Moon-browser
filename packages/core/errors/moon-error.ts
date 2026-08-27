export type MoonErrorContext = Readonly<Record<string, unknown>>;

export interface MoonErrorOptions {
  readonly cause?: unknown;
  readonly context?: MoonErrorContext;
  readonly recoverable?: boolean;
}

export interface SerializedMoonError {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  readonly context: MoonErrorContext;
  readonly recoverable: boolean;
  readonly timestamp: number;
  readonly stack?: string;
}

export class MoonError extends Error {
  readonly code: string;
  readonly context: MoonErrorContext;
  readonly recoverable: boolean;
  readonly timestamp: number;

  constructor(
    code: string,
    message: string,
    options: MoonErrorOptions = {}
  ) {
    super(message, { cause: options.cause });

    this.name = "MoonError";
    this.code = code;
    this.context = options.context ?? {};
    this.recoverable = options.recoverable ?? false;
    this.timestamp = Date.now();
  }

  toJSON(): SerializedMoonError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}
