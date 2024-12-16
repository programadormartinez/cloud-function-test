import * as admin from 'firebase-admin';

import { onNotificationWriteFunction } from './collections/notifications/notification.on-write.function';

admin.initializeApp();

// Collections
export const onNotificationWrite = onNotificationWriteFunction;


