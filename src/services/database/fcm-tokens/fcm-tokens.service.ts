import { FcmToken } from '../../../collections/fcm-tokens/fcm-token.model';
import { CollectionService } from '../collection.service';
export class FcmTokensService extends CollectionService<FcmToken> {
  public static instance: FcmTokensService;
  public static getInstance(): FcmTokensService {
    if (FcmTokensService.instance) {
      return FcmTokensService.instance;
    }
    FcmTokensService.instance = new FcmTokensService('fcmTokens');
    return FcmTokensService.instance;
  }
}
