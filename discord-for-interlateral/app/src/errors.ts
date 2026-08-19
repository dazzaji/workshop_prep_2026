export class BridgeError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "BridgeError";
  }
}

export function jsonError(code: string, status: number): BridgeError {
  return new BridgeError(code, status);
}
