export class KnownError extends Error {
  constructor(public code: string, public message: string, ...params: any[]) {
    super(`Known error with code ${code}: ${message}`);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, KnownError);
    }
  }
}
