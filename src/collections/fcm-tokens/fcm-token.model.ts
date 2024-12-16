
export interface FcmToken {
  _onCreateEventId?: string;
  _onCreateMaxRetries?: number;
  _onCreateMaxRetriesReached?: true;
  _onCreateRetries?: number;
  id: string;
  deviceId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}
