export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown, public headers?: Record<string, string>) {
    super(message);
  }
}
