export interface DatabaseDocument {
  _onCreateEventId?: string;
  _onCreateMaxRetries?: number;
  _onCreateMaxRetriesReached?: true;
  _onCreateRetries?: number;
  createdAt: Date;
  id: string;
  updatedAt: Date;
}
