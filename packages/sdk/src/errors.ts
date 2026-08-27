/** Root error class for all errors thrown by the SDK. */
export class InterventionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterventionError";
  }
}

/** Thrown for client-side input problems before any request is sent. */
export class InterventionValidationError extends InterventionError {
  constructor(message: string) {
    super(message);
    this.name = "InterventionValidationError";
  }
}

/** Thrown when a request exceeds the configured timeout. */
export class InterventionTimeoutError extends InterventionError {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "InterventionTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Thrown when the API returns a non-2xx response. `status` is the HTTP code. */
export class InterventionApiError extends InterventionError {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "InterventionApiError";
    this.status = status;
  }
}
