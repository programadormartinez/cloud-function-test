/* eslint-disable @typescript-eslint/no-unsafe-return */

import { stringify } from "querystring";

export function printError(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error && error.stack && typeof(error.message) === 'string') {
    return error.message;
  }
  if (typeof error === 'object') {
    return stringify(error);
  }
  return error.toString ? error.toString() : error;
}
