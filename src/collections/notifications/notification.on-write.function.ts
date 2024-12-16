
import { DatabaseService } from '../../services/database/database.service';
import { collectionOnWriteFunction } from '../../utils/collections/collections.utils';
import { Logger } from '../../utils/logging/logging.utils';
import { sendPushNotification } from '../../utils/notifications/notifications.utils';
import { Notification } from './notification.model';

export const onNotificationWriteFunction = collectionOnWriteFunction({
  functions: {
    onCreate: {
      options: {
        defaultData: {
        }
      },
      function: _onCreate
    }
  },
  labels: { document: 'notification', collection: 'notifications' },
  loggerOptions: { fieldsInDefaultMeta: { id: 'notificationId', userId: 'userId' } }
});

async function _onCreate(returnValues: { db: DatabaseService; documentData: Notification; logger: Logger }): Promise<void> {
  const { db, documentData, logger } = returnValues;
  logger.changeStep('send-push-notification');
  await sendPushNotification(db, documentData.userId, {
    data: documentData.metadata,
    notification: {
      title: documentData.title,
      body: documentData.body
    }
  }, logger);
}
