import { runRetriableAction } from '../../utils/database/database.utils';
import { Logger } from '../../utils/logging/logging.utils';
import { changeTimestampsToDate } from '../../utils/parse/parse.utils';
import { DatabaseService } from './database.service';

export interface QueryFieldConfig {
  whereFilter: FirebaseFirestore.WhereFilterOp;

  value: any;
}
export interface QueryConfig {
  [field: string]: boolean | null | number | string | QueryFieldConfig | QueryFieldConfig[];
}
export interface DocumentCreateData {
  [field: string]: any;
}
export interface DocumentUpdateData {
  [field: string]: any;
}

export class CollectionService<T> {
  protected _childCollection = '';
  protected _collectionPath: string;
  protected _parentCollection = '';
  constructor(collectionPath: string) {
    this._collectionPath = collectionPath;
    if (this._collectionPath.includes('/')) {
      const pathLevels = this._collectionPath.split('/');
      this._parentCollection = pathLevels[0];
      this._childCollection = pathLevels[1];
    }
  }
  public createDocument(db: DatabaseService, data: DocumentCreateData, logger: Logger, config?: {
    id?: string;
    parentId?: string;
  }): Promise<string>;
  public createDocument(db: DatabaseService, data: DocumentCreateData, logger: Logger, config?: {
    id?: string;
    parentId?: string;
    transaction: FirebaseFirestore.Transaction;
  } | {
    batch: FirebaseFirestore.WriteBatch;
    id?: string;
    parentId?: string;
  }): string;
  public createDocument(db: DatabaseService, data: DocumentCreateData, logger: Logger, config?: {
    batch?: FirebaseFirestore.WriteBatch;
    id?: string;
    parentId?: string;
    transaction?: FirebaseFirestore.Transaction;
  }): Promise<string> | string {
    const path = this._getPath(config?.parentId);
    const documentRef = config?.id ? db.collection(path).doc(config.id) : db.collection(path).doc();
    const documentData = {
      ...data,
      createdAt: DatabaseService.serverTimestampFieldValue(),
      updatedAt: DatabaseService.serverTimestampFieldValue()
    };
    if (config?.batch || config?.transaction) {
      ((config?.batch || config?.transaction) as FirebaseFirestore.WriteBatch || FirebaseFirestore.Transaction).create(documentRef, documentData);
      return documentRef.id;
    }
    // we can't use `async` since it will force us to always return a Promise, so we need to handle this logic with `.then()`
    return runRetriableAction(() => documentRef.create(documentData).then(() => documentRef.id), logger);
  }

  public deleteDocument(db: DatabaseService, documentId: string, logger: Logger, config?: {
    parentId?: string;
  }): Promise<void>;
  public deleteDocument(db: DatabaseService, documentId: string, logger: Logger, config?: {
    parentId?: string;
    transaction: FirebaseFirestore.Transaction;
  } | {
    batch: FirebaseFirestore.WriteBatch;
    parentId?: string;
  }): void;
  public deleteDocument(db: DatabaseService, documentId: string, logger: Logger, config?: {
    batch?: FirebaseFirestore.WriteBatch;
    parentId?: string;
    transaction?: FirebaseFirestore.Transaction;
  }): Promise<void> | void {
    const path = this._getPath(config?.parentId);
    const documentRef = db.collection(path).doc(documentId);
    if (config?.batch || config?.transaction) {
      ((config?.batch || config?.transaction) as FirebaseFirestore.WriteBatch || FirebaseFirestore.Transaction).delete(documentRef);
      return;
    }
    // we can't use `async` since it will force us to always return a Promise, so we need to handle this logic with `.then()`
    return runRetriableAction(() => documentRef.delete(), logger).then();
  }

  public async getDocument(db: DatabaseService, documentId: string, config?: {
    parentId?: string;
    transaction?: FirebaseFirestore.Transaction;
  }): Promise<T | null> {
    const path = this._getPath(config?.parentId);
    const documentRef = db.collection(path).doc(documentId);
    const documentSnapshot = config?.transaction ?
      await config.transaction.get(documentRef) :
      await documentRef.get();
    if (!documentSnapshot.exists) {
      return null;
    }
    return this._parseDocument(documentSnapshot);
  }
  public async getDocumentsList(db: DatabaseService, query: QueryConfig, config?: {
    limit?: number;
    offset?: number;
    orderBy?: { field: string; direction: 'desc' | 'asc' };
    parentId?: string;
    transaction?: FirebaseFirestore.Transaction;
  }): Promise<T[]> {
    let queryRef: FirebaseFirestore.Query;
    if (this._childCollection && !config?.parentId) {
      queryRef = (db as FirebaseFirestore.Firestore).collectionGroup(this._childCollection);
    } else {
      queryRef = db.collection(this._getPath(config?.parentId));
    }
    for (const [field, queryFieldConfig] of Object.entries(query)) {
      if (Array.isArray(queryFieldConfig)) {
        for (const queryFieldConfigItem of queryFieldConfig) {
          queryRef = queryRef.where(field, queryFieldConfigItem.whereFilter, queryFieldConfigItem.value);
        }
      } else if (queryFieldConfig && typeof(queryFieldConfig) === 'object') {
        queryRef = queryRef.where(field, queryFieldConfig.whereFilter, queryFieldConfig.value);
      } else {
        queryRef = queryRef.where(field, '==', queryFieldConfig);
      }
    }
    if (config?.orderBy) {
      queryRef = queryRef.orderBy(config.orderBy.field, config.orderBy.direction);
    }
    if (config?.offset) {
      queryRef = queryRef.offset(config?.offset);
    }
    if (config?.limit) {
      queryRef = queryRef.limit(config?.limit);
    }
    const documentQuerySnapshot = config?.transaction ?
      await config.transaction.get(queryRef) :
      await queryRef.get();
    return documentQuerySnapshot.docs.map((documentSnapshot) => this._parseDocument(documentSnapshot));
  }
  public updateDocument(db: DatabaseService, documentId: string, updateData: DocumentUpdateData, logger: Logger, config?: {
    ignoreTimestamp?: boolean;
    parentId?: string;
  }): Promise<void>;
  public updateDocument(db: DatabaseService, documentId: string, updateData: DocumentUpdateData, logger: Logger, config?: {
    batch?: FirebaseFirestore.WriteBatch;
    ignoreTimestamp?: boolean;
    parentId?: string;
    transaction?: FirebaseFirestore.Transaction;
  }): void;
  public updateDocument(db: DatabaseService, documentId: string, updateData: DocumentUpdateData, logger: Logger, config?: {
    batch?: FirebaseFirestore.WriteBatch;
    ignoreTimestamp?: boolean;
    parentId?: string;
    transaction?: FirebaseFirestore.Transaction;
  }): Promise<void> | void {
    const path = this._getPath(config?.parentId);
    const finalConfig = {
      ignoreTimestamp: false,
      ...config
    };
    if (config?.batch || config?.transaction) {
      ((config?.batch || config?.transaction) as FirebaseFirestore.WriteBatch || FirebaseFirestore.Transaction).update(db.collection(path).doc(documentId), {
        ...updateData,
        ...(!finalConfig.ignoreTimestamp && { updatedAt: DatabaseService.serverTimestampFieldValue() })
      });
      return;
    }
    // we can't use `async` since it will force us to always return a Promise, so we need to handle this logic with `.then()`
    return runRetriableAction(() => db.collection(path).doc(documentId).update({
      ...updateData,
      ...(!finalConfig.ignoreTimestamp && { updatedAt: DatabaseService.serverTimestampFieldValue() })
    }).then(), logger);
  }
  private _getPath(parentId?: string): string {
    if (this._collectionPath.includes('/')) {
      if (parentId) {
        return `${this._parentCollection}/${parentId}/${this._childCollection}`;
      }
      throw new Error(`parentId parameter must be submitted since ${this._collectionPath} is a sub-collection`);
    }
    return this._collectionPath;
  }
  private _parseDocument(documentSnapshot: FirebaseFirestore.DocumentSnapshot): T {
    return { id: documentSnapshot.id, ...changeTimestampsToDate(documentSnapshot.data()) } as unknown as T;
  }
}
