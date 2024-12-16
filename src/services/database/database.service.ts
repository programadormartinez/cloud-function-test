/* eslint-disable @typescript-eslint/no-unused-vars */
import * as admin from 'firebase-admin';
export class DatabaseService {
  /* ------ STATIC FIELDS AND FUNCTIONS ------ */
  public static instance: DatabaseService;
  public static deleteFieldValue(): FirebaseFirestore.FieldValue {
    return admin.firestore.FieldValue.delete();
  }
  public static getInstance(): DatabaseService {
    if (DatabaseService.instance) {
      return DatabaseService.instance;
    }
    DatabaseService.instance = admin.firestore();
    return DatabaseService.instance;
  }
  public static incrementTimestampFieldValue(n: number): FirebaseFirestore.FieldValue {
    return admin.firestore.FieldValue.increment(n);
  }
  public static serverTimestampFieldValue(): FirebaseFirestore.FieldValue {
    return admin.firestore.FieldValue.serverTimestamp();
  }
  public static async documentFromPath(documentPath: string): Promise<any> {
    if (!DatabaseService.instance) {
      throw new Error('DB has not been initialized yet.');
    }
    const documentRef = (DatabaseService.instance as FirebaseFirestore.Firestore).doc(documentPath);
    const documentSnap = await documentRef.get();
    return !documentSnap.exists ? null : {...documentSnap.data(), id: documentRef.id };
  }
  /* ------ END OF STATIC FIELDS AND FUNCTIONS ------ */
  public batch(): FirebaseFirestore.WriteBatch {
    throw new Error('DB has not been initialized yet.');
  }
  public collection(_collectionPath: string): FirebaseFirestore.CollectionReference {
    throw new Error('DB has not been initialized yet.');
  }
  public doc(_docPath: string): FirebaseFirestore.DocumentReference {
    throw new Error('DB has not been initialized yet.');
  }
  public runTransaction<T>(
    _updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>,
    _transactionOptions?: { maxAttempts?: number }
  ): Promise<T> {
    throw new Error('DB has not been initialized yet.');
  }
}
