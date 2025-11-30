import { ErrorPageMessageType } from './error-page-message.type';

export interface ErrorPageData {
  message: ErrorPageMessageType;
  code?: string | number;
}
