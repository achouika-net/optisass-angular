import { LOCAL_STORAGE_KEYS } from '@app/config';

export type LocalStorageKey =
  | (typeof LOCAL_STORAGE_KEYS.STORE)[keyof typeof LOCAL_STORAGE_KEYS.STORE]
  | (typeof LOCAL_STORAGE_KEYS.APP)[keyof typeof LOCAL_STORAGE_KEYS.APP]
  | (typeof LOCAL_STORAGE_KEYS.DOWNLOAD)[keyof typeof LOCAL_STORAGE_KEYS.DOWNLOAD];
