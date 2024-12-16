import * as admin from 'firebase-admin';


import { DatabaseService } from '../../services/database/database.service';
import { printError } from '../errors/errors.utils';
import { KnownError } from '../errors/known-error.class';
import { Logger } from '../logging/logging.utils';
import { changeTimestampsToDateISOString } from '../parse/parse.utils';
import { wait } from '../time/time.utils';
import { GENERAL_ERROR_CODE, TRANSACTION_ERROR_CODE } from '../../services/database/database.constants';
export interface WhereQuery {
  field: string;
  condition: '==' | '>' | '>=' | '<' | '<=';
  value: string | number | boolean | null;
  valueType: 'boolean' | 'number' | 'string' | 'null';
}

export interface QueryConfig {
  direction?: 'asc' | 'desc';
  endAt?: Date | null;
  limit?: number | null;
  orderBy?: string;
  startAt?: Date | null;
  wheres?: WhereQuery[] | null;
}
export class CheckIfEventHasBeenProcessedError extends KnownError {
  constructor(public code: 'document-not-found' | 'max-retries-reached', public message: string, ...params: any[]) {
    super(code, message, ...params);
    Object.setPrototypeOf(this, CheckIfEventHasBeenProcessedError.prototype);
  }
}
export function checkIfEventHasBeenProcessed(db: DatabaseService, ref: string | FirebaseFirestore.DocumentReference, eventName: string, eventId: string, logger: Logger, options?: {
  createIfDoesntExists?: boolean;
  extraData?: {[key: string]: any};
  ignoreIfDoesntExists?: boolean;
  maxRetries?: number;
}): Promise<{
    documentData: any;
    hasBeenProcessed: boolean;
  }> {
  const config = {
    createIfDoesntExists: options?.createIfDoesntExists || false,
    extraData: options?.extraData || {},
    ignoreIfDoesntExists: options?.ignoreIfDoesntExists || false,
    maxRetries: options?.maxRetries || 5
  };
  const docRef = typeof(ref) === 'string' ? db.doc(ref) : ref;
  return runRetriableTransaction(db, (async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const eventLabel = `${eventName}EventId`, eventRetriesLabel = `${eventName}Retries`, eventMaxRetriesLabel = `${eventName}MaxRetries`;
    const newData = { ...config.extraData } as any;
    newData[eventLabel] = eventId;
    if (snapshot.exists) {
      const data = snapshot.data() as any;
      if (data[eventLabel]) {
        return { documentData: { ...data, ...newData }, hasBeenProcessed: true };
      }
      for (const key in newData) {
        if (data[key] !== undefined) {
          newData[key] = data[key];
        }
      }
      if (data[eventRetriesLabel] === undefined) {
        newData[eventRetriesLabel] = 0;
        newData[eventMaxRetriesLabel] = config.maxRetries;
      } else {
        newData[eventRetriesLabel] = (data[eventRetriesLabel] as number) + 1;
        newData[eventMaxRetriesLabel] = data[eventMaxRetriesLabel];
      }
      if (newData[eventRetriesLabel] > newData[eventMaxRetriesLabel]) {
        throw new CheckIfEventHasBeenProcessedError('max-retries-reached', `Document ${docRef.id} has reached it's ${eventLabel} max retries of ${newData[eventMaxRetriesLabel]} times.`);
      }
      transaction.update(docRef, newData);
      return { documentData: { ...data, ...newData }, hasBeenProcessed: false };
    }
    if (config.createIfDoesntExists) {
      newData[eventRetriesLabel] = 0;
      transaction.create(docRef, {
        ...newData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { documentData: newData, hasBeenProcessed: false };
    }
    throw new CheckIfEventHasBeenProcessedError('document-not-found', `Document ${docRef.id} not found.`);
  }), logger);
}
export async function getQueryDocuments(db: DatabaseService, collection: string, queryConfig: QueryConfig): Promise<any[]> {
  let query = db.collection(collection).orderBy(queryConfig.orderBy ? queryConfig.orderBy : 'createdAt', queryConfig.direction);
  if (queryConfig.wheres) {
    for (const where of queryConfig.wheres) {
      query = query.where(where.field, where.condition, where.value);
    }
  }
  if (queryConfig.startAt) {
    query = query.startAt(queryConfig.startAt);
  }
  if (queryConfig.endAt) {
    query = query.endAt(queryConfig.endAt);
  }
  if (queryConfig.limit) {
    query = query.limit(queryConfig.limit);
  }
  const documentsSnapshots = await query.get();
  return documentsSnapshots.docs.map((documentSnapshot) => ({id: documentSnapshot.id, ...changeTimestampsToDateISOString(documentSnapshot.data())}));
}
export function parseQueryWheresParameter(wheresParam: string): WhereQuery[] {
  const items = wheresParam.split(',');
  const values: WhereQuery[] = [];
  for (let i = 0; i < items.length; i += 4) {
    const valueType = items[i + 3] as 'boolean' | 'number' | 'string' | 'null';
    let value: string | number | boolean | null = items[i + 2];
    if (valueType !== 'string') {
      if (valueType === 'boolean') {
        value = value === 'true';
      } else if (valueType === 'number') {
        value = +value;
      } else {
        value = null;
      }
    }
    values.push({
      field: items[i],
      condition: items[i + 1] as '==' | '>' | '>=' | '<' | '<=',
      value,
      valueType
    });
  }
  return values;
}
interface RetriableActionConfig {
  delay?: number;
  maxRetries?: number;
}
export class RunRetriableActionError extends KnownError {
  constructor(public code: 'max-retries-reached', public message: string, ...params: any[]) {
    super(code, message, ...params);
    Object.setPrototypeOf(this, RunRetriableActionError.prototype);
  }
}
export function runRetriableAction<T>(actionFn: (...args: any[]) => Promise<T>, logger: Logger, configOptions?: RetriableActionConfig): Promise<T> {
  const config = { delay: 1000, maxRetries: 5, ...configOptions };
  const runAction = async (retry = 0): Promise<T> => {
    try {
      const result = await actionFn();
      return result;
    } catch (error: any) {
      if (error && typeof error === 'object') {
        logger.warn(`warning: Error in retriable action, error ${printError(error)}`, { eventName: 'error-in-retriable-action', code: error.code || null, retries: retry });
        if (error.code === GENERAL_ERROR_CODE.INTERNAL
        || error.code === GENERAL_ERROR_CODE.UNAVAILABLE
        || error.code === 'retry') {
          if (retry < config.maxRetries) {
            await wait(error.delay || config.delay);
            return runAction(retry + 1);
          }
          throw new RunRetriableActionError('max-retries-reached', `Action has been retried ${config.maxRetries} times and did not finish successfully.`);
        } else if (error.code) {
          logger.warn(`warning: Unhandled error code ${error.code}, error ${printError(error)}`, {eventName: 'unhandled-error-code', code: error.code});
        }
      } else {
        logger.warn(`warning: Non-object error in retriable action, error ${printError(error)}`, { eventName: 'no-object-error-in-retriable-action', error, retries: retry });
      }
      return Promise.reject(error);
    }
  };
  return runAction();
}

export function runRetriableTransaction<T>(db: DatabaseService, transactionFn: (transaction: FirebaseFirestore.Transaction) => Promise<T>, logger: Logger, configOptions?: { delay?: number; maxRetries?: number }): Promise<T> {
  const config = { delay: 1000, maxRetries: 5, ...configOptions };
  const runTransaction = async (retry = 0): Promise<T> => {
    try {
      const result = await db.runTransaction(transactionFn);
      return result;
    } catch (error: any) {
      if (error && typeof error === 'object') {
        logger.warn(`warning: Error in retriable transaction, error ${printError(error)}`, { eventName: 'error-in-retriable-transaction', code: error.code || null, retries: retry });
        if (error.code === TRANSACTION_ERROR_CODE.TOO_MUCH_CONTENTION
          || error.code === GENERAL_ERROR_CODE.INTERNAL
          || error.code === GENERAL_ERROR_CODE.UNAVAILABLE
          || error.code === 'retry') {
          if (retry < config.maxRetries) {
            await wait(error.delay || config.delay);
            return runTransaction(retry + 1);
          }
          throw new RunRetriableActionError('max-retries-reached', `Transaction has been retried ${config.maxRetries} times and did not finish successfully.`);
        }
      } else {
        logger.warn(`warning: Non-object error in retriable transaction, error ${printError(error)}`, { eventName: 'no-object-error-in-retriable-transaction', error, retries: retry });
      }
      return Promise.reject(error);
    }
  };
  return runTransaction();
}

export function safeObjectForSavingInDB(obj: any): any {
  if (typeof(obj) !== 'object' || obj === null) {
    return obj;
  }
  const modifiedObj = { ...obj };
  const keys = Object.keys(modifiedObj);
  const returnObj: any = {};
  for (let i = 0; i < keys.length && i < 10; i++) { // el "10" es para evitar guardar objetos grandes
    const key = keys[i];
    returnObj[key] = modifiedObj[key];
  }
  return returnObj;
}

export function validateRequestQueryConfig(requestQuery: any): { code: string; message: string } | null {
  if (requestQuery.direction && requestQuery.direction !== 'asc' && requestQuery.direction !== 'desc') {
    return {
      message: 'Invalid direction parameter. It should be "asc" or "desc"',
      code: 'invalid-direction'
    };
  }
  if (requestQuery.endAt && isNaN(new Date(requestQuery.endAt).getTime())) {
    return {
      message: 'Invalid endAt parameter. It should be a valid date.',
      code: 'invalid-end-at'
    };
  }
  if (requestQuery.limit && (isNaN(+requestQuery.limit) || +requestQuery.limit <= 0)) {
    return {
      message: 'Invalid limit parameter. It should be a positive number.',
      code: 'invalid-limit'
    };
  }
  if (requestQuery.orderBy && requestQuery.orderBy !== 'createdAt' && requestQuery.orderBy !== 'updatedAt') {
    return {
      message: 'Invalid orderBy parameter. It should be either "createdAt" or "updatedAt".',
      code: 'invalid-order-by'
    };
  }
  if (requestQuery.startAt && isNaN(new Date(requestQuery.startAt).getTime())) {
    return {
      message: 'Invalid startAt parameter. It should be a valid date.',
      code: 'invalid-start-at'
    };
  }
  if (requestQuery.wheres) {
    const items = requestQuery.wheres.split(',');
    if (items.length % 4 !== 0) {
      return {
        message: 'Invalid wheres parameter. It should have a multiple of 4 items.',
        code: 'invalid-wheres'
      };
    }
    for (let i = 0; i < items.length; i += 4) {
      const condition = items[i + 1];
      if (!['==', '>', '>=', '<', '<='].includes(condition)) {
        return {
          message: 'Invalid wheres parameter. One of the conditions is not valid.',
          code: 'invalid-wheres'
        };
      }
      const value = items[i + 2];
      const valueType = items[i + 3];
      if (valueType === 'boolean' && value !== 'true' && value !== 'false') {
        return {
          message: 'Invalid wheres parameter. Boolean value must be "true" or "false".',
          code: 'invalid-wheres'
        };
      } else if (valueType === 'number' && isNaN(+value)) {
        return {
          message: 'Invalid wheres parameter. Number value is not valid.',
          code: 'invalid-wheres'
        };
      } else if (valueType === 'null' && value !== 'null') {
        return {
          message: 'Invalid wheres parameter. Null value must be "null".',
          code: 'invalid-wheres'
        };
      } else if (valueType !== 'string' && valueType !== 'boolean' && valueType !== 'number' && valueType !== 'null') {
        return {
          message: 'Invalid wheres parameter. Value type is not valid.',
          code: 'invalid-wheres'
        };
      }
    }
  }
  return null;
}
