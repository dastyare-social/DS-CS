export class DemoModeError extends Error {
  constructor() {
    super(
      "demo mode is enabled — create, update and delete operations are disabled",
    );
    this.name = "DemoModeError";
  }
}

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function assertWritable(): void {
  if (isDemoMode()) {
    throw new DemoModeError();
  }
}
