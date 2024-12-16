import { DatabaseDocument } from "../database-document.model";



export interface Notification extends DatabaseDocument {
  body: string;
  metadata: any;
  seen: boolean;
  title: string;
  userId: string;
}
