/**
 * An error the CLI knows how to explain to a human. `hint` is printed under
 * the message; anything without a hint is probably a bug.
 */
export class CliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "CliError";
    this.hint = options.hint;
    this.exitCode = options.exitCode ?? 1;
    if (options.cause) this.cause = options.cause;
  }
}
