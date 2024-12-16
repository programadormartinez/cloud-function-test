import * as admin from 'firebase-admin';

import { FcmTokensService } from '../../services/database/fcm-tokens/fcm-tokens.service';
import { printError } from '../errors/errors.utils';
import { getUsersFcmTokens } from '../fcm-tokens/fcm-tokens.utils';
import { Logger } from '../logging/logging.utils';
import { DatabaseService } from '../../services/database/database.service';

export async function sendPushNotification(db: DatabaseService, userId: string, payload: admin.messaging.MessagingPayload, logger: Logger): Promise<void> {
  let step = '';
  try {
    step = 'get-fcm-tokens';
    logger.changeStep('get-fcm-tokens');
    const fcmTokens = await getUsersFcmTokens(db, userId);
    if (!fcmTokens || !fcmTokens.length) {
      logger.changeStep('get-fcm-tokens-return-if');
      return;
    }
    const response = await admin.messaging().sendEachForMulticast({ tokens: fcmTokens, ...payload });
    step = 'handle-notifications-response';
    logger.changeStep('handle-notifications-response');
    await _handleNotificationsResponse(db, fcmTokens, response, payload, logger);
  } catch (error) {
    return Promise.reject({ error, step });
  }
}

async function _handleNotificationsResponse(db: DatabaseService, tokens: string[], response: admin.messaging.BatchResponse, payload: any, logger: Logger): Promise<void> {
  const tokensToRemovePromises: Promise<void>[] = [];
  const fcmTokensService = FcmTokensService.getInstance();
  response.responses.forEach((result, index) => {
    const error = result.error;
    if (error) {
      logger.info(`Failed push notification to token ${tokens[index]} with error ${printError(error)}.`, { eventName: 'failed-push-notification', token: tokens[index], code: error.code ? error.code : null, payload });
      if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
        tokensToRemovePromises.push(fcmTokensService.deleteDocument(db, tokens[index], logger));
      }
    } else {
      logger.info(`Push notification sent to token ${tokens[index]}.`, { eventName: 'push-notification-sent', token: tokens[index], payload });
    }
  });
  if (tokensToRemovePromises.length) {
    await Promise.all(tokensToRemovePromises)
      .catch((error) => {
        logger.warn(`warning: failed to remove ${tokensToRemovePromises.length} tokens with error ${printError(error)}.`, { eventName: 'token-remove-failed', source: 'push-notification-delivery' });
      });
  }
}
