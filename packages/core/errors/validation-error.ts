import { MoonError, type MoonErrorOptions } from "./moon-error.js";

export interface ValidationIssue {
  readonly path: readonly (string | number)[];
  readonly code: string;
  readonly message: string;
  readonly value?: unknown;
}

export interface ValidationErrorOptions extends MoonErrorOptions {
  readonly issues?: readonly ValidationIssue[];
}

export class ValidationError extends MoonError {
  readonly issues: readonly ValidationIssue[];

  constructor(
    message: string,
    options: ValidationErrorOptions = {}
  ) {
    const issues = options.issues ?? [];

    super("VALIDATION_FAILED", message, {
      cause: options.cause,
      context: {
        ...options.context,
        issues
      },
      recoverable: options.recoverable ?? true
    });

    this.name = "ValidationError";
    this.issues = issues;
  }

  hasIssueAt(...path: readonly (string | number)[]): boolean {
    return this.issues.some(issue =>
      issue.path.length === path.length &&
      issue.path.every((segment, index) => segment === path[index])
    );
  }
}
