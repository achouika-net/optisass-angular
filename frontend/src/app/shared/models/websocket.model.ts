/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WebSocketMessage<T = unknown> {
  event: string;
  channel?: string;
  data?: T | string;
}

export interface WebSocketResponse<T = unknown> {
  event: string;
  channel: string;
  data: T;
}

export interface ChannelTemplate {
  name: string | ((params: any) => string);
  actionType: string;
  isPermanent: boolean;
  timeout?: number; // durée en ms
}
export interface Channel {
  name: string;
  actionType: string;
  isPermanent: boolean;
  isCreated: boolean;
  expiresAt?: string; // date ISO de expiration calculée à partir du timeout
}

export type MessageHandler<T = any> = (message: WebSocketResponse<T>) => any;
