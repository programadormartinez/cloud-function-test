import { checkIfEventHasBeenProcessed, CheckIfEventHasBeenProcessedError } from '../database/database.utils';
import { printError } from '../errors/errors.utils';
import { createLogger, Logger, LoggerOptions } from '../logging/logging.utils';
import { maskMap } from '../mask/mask.utils';
import { changeTimestampsToDate, changeTimestampsToDateISOString, removeMetadata } from '../parse/parse.utils';
import { DatabaseService } from '../../services/database/database.service';
import { Change, CloudFunction, EventContext, runWith } from 'firebase-functions/v1';
import { DocumentSnapshot } from 'firebase-admin/firestore';

type CollectionFunctionLoggerOption = LoggerOptions & { fieldsInDefaultMeta?: { [field: string]: string } };
interface CollectionLabels {
  collection: string;
  document: string;
  parent?: CollectionLabels;
}
interface OnCreateConfig {
  function?: OnCreateFunction;
  options?: {
    defaultData?: { [key: string]: any };
    ignoreIfDoesntExists?: boolean;
    maskFields?: string[];
    maxRetries?: number;
  };
}

type OnCreateFunction = (returnValues: {
  context: EventContext;
  db: DatabaseService;
  documentData: any;
  logger: Logger;
}) => Promise<void>;

export function collectionOnWriteFunction(options: {
  functions: {
    onCreate?: OnCreateConfig;
  };
  labels: CollectionLabels;
  loggerOptions?: CollectionFunctionLoggerOption;
  config?: {
    maxInstances?: number;
    memory?: '128MB' | '512MB' | '256MB' | '1GB' | '2GB';
    retryOnFail?: boolean;
    timeoutSeconds?: number;
  };
}): CloudFunction<Change<DocumentSnapshot>> {
  return runWith({
      failurePolicy: options.config?.retryOnFail !== undefined ? options.config.retryOnFail : true,
      ...(options.config?.maxInstances && { maxInstances: options.config.maxInstances }),
      ...(options.config?.memory && { memory: options.config.memory }),
      ...(options.config?.timeoutSeconds && { timeoutSeconds: options.config.timeoutSeconds }),
    }).firestore.document(_getPath(options.labels))
    .onWrite(async (change, context) => {
      const eventName = change.before.exists ? change.after.exists ? 'on-update' : 'on-delete' : 'on-create';
      const db = DatabaseService.getInstance();
      if (eventName === 'on-create') {
        await _onCreate(db, change.after, context, options.labels, options.loggerOptions, options.functions.onCreate);
        return;
      }
    });
}

function _getPath(labels: CollectionLabels): string {
  const path = `${labels.collection}/{${labels.document}Id}`;
  if (labels.parent?.collection && labels.parent?.document) {
    return `${_getPath(labels.parent)}/${path}`;
  }
  return path;
}

async function _onCreate(db: DatabaseService, newDocumentSnap: FirebaseFirestore.DocumentSnapshot, context: EventContext, labels: CollectionLabels, loggerOptions?: CollectionFunctionLoggerOption, config?: OnCreateConfig): Promise<void> {
  const documentData = { ...newDocumentSnap.data(), id: newDocumentSnap.id } as any;
  const defaultMeta: any = {
    ...loggerOptions?.defaultMeta,
    context: {
      auth: context.auth || null,
      authType: context.authType || null,
      eventId: context.eventId,
      params: context.params
    },
    documentId: newDocumentSnap.id,
    event: 'on-create'
  };
  if (loggerOptions && loggerOptions.fieldsInDefaultMeta) {
    for (const field in loggerOptions.fieldsInDefaultMeta) {
      defaultMeta[loggerOptions.fieldsInDefaultMeta[field]] = documentData[field] || null;
    }
  }
  const logger = createLogger({
    ...loggerOptions,
    defaultMeta
  });
  logger.info(`${labels.document} ${newDocumentSnap.id} on create.`, { eventName: 'on-create', documentData: maskMap(changeTimestampsToDateISOString(documentData), config?.options?.maskFields) });
  if (config) {
    try {
      logger.changeStep('initial-transaction');
      const result = await checkIfEventHasBeenProcessed(db, newDocumentSnap.ref, '_onCreate', context.eventId, logger, { extraData: config.options?.defaultData, maxRetries: config.options?.maxRetries })
        .catch(async (error) => {
          if (error instanceof CheckIfEventHasBeenProcessedError) {
            if (error.code === 'document-not-found' && config.options?.ignoreIfDoesntExists) {
              logger.debug(`${labels.document} ${newDocumentSnap.id} not found.`, { eventName: 'document-not-found' });
              return Promise.reject('already-handled');
            }
            if (error.code === 'max-retries-reached') {
              logger.error(`CRITICAL ERROR: max retries reached in ${labels.document} ${newDocumentSnap.id}.`, { eventName: 'max-retries-reached' }, 'CRITICAL');
              await newDocumentSnap.ref.update({
                _onCreateMaxRetriesReached: true,
              }).catch((updateError) => {
                logger.error(`CRITICAL ERROR: could not update max retries reached flag on ${labels.document} ${newDocumentSnap.id}.`, { eventName: 'error-setting-max-retries-reached', error: updateError }, 'CRITICAL');
                return Promise.reject(error);
              });
              return Promise.reject('already-handled');
            }
          }
          return Promise.reject(error);
        });
      if (result.hasBeenProcessed) {
        logger.debug(`On create already processed in ${labels.document} ${newDocumentSnap.id}.`, { eventName: 'on-create-already-processed' });
        return;
      }
      if (config.function) {
        await config.function({ context, db, documentData: { ...changeTimestampsToDate(result.documentData), id: newDocumentSnap.id }, logger });
      }
    } catch (error) {
      if (error === 'already-handled') {
        return;
      }
      logger.error(`Unknown error in on create of ${labels.document} ${newDocumentSnap.id} in step ${logger.currentStep.label}, error ${printError(error)}`, { eventName: 'unknown-error', step: logger.currentStep.label, error });
      await newDocumentSnap.ref.update({
        _onCreateEventId: null,
      }).catch((updateError) => {
        logger.error(`CRITICAL ERROR: could not reverse ${labels.document} ${newDocumentSnap.id} to its initial state.`, { eventName: 'error-reversing-document-to-initial-state', error: updateError }, 'CRITICAL');
        return Promise.reject(error);
      });
      return Promise.reject(error);
    }
  }
  logger.clear();
}
