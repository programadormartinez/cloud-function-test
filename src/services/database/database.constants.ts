/* eslint-disable no-shadow */

export enum GENERAL_ERROR_CODE {
  INTERNAL = 13, // "INTERNAL: Received RST_STREAM with code 2"
  UNAVAILABLE = 14 // "UNAVAILABLE: The service is temporarily unavailable."
}
export enum TRANSACTION_ERROR_CODE {
  TOO_MUCH_CONTENTION = 10, // "ABORTED: Too much contention on these documents. Please try again." (concurrency error)
}
export enum WRITE_ERROR_CODE {
  NOT_FOUND = 5, // NOT_FOUND: No document to update
  ALREADY_EXISTS = 6 // "ALREADY_EXISTS: Document already exists"
}
