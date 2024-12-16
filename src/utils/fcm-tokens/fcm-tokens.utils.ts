import { DatabaseService } from '../../services/database/database.service';
import { FcmTokensService } from '../../services/database/fcm-tokens/fcm-tokens.service';

export async function getUsersFcmTokens(db: DatabaseService, userId: string): Promise<string[]> {
  const queryDocuments = await FcmTokensService.getInstance().getDocumentsList(db, {
    userId: { whereFilter: '==', value: userId }
  });
  return queryDocuments.map((doc) => doc.id);
}
