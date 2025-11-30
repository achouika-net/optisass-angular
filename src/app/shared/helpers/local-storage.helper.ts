import { CRYPT_KEY } from '@app/config';
import { AES, enc } from 'crypto-ts';
import { LocalStorageKey } from '@app/types';

export const setLocalStorageItem = <T>(key: LocalStorageKey, data: T): void => {
  try {
    let serializedData: string;
    if (data instanceof Map) {
      serializedData = JSON.stringify(Array.from(data.entries()));
    } else {
      serializedData = JSON.stringify(data);
    }
    const encryptedData = AES.encrypt(serializedData, CRYPT_KEY).toString();
    localStorage.setItem(key, encryptedData);
  } catch {
    localStorage.setItem(key, '');
  }
};

export const getLocalStorageItem = <T>(key: LocalStorageKey): T | null => {
  try {
    let text = localStorage.getItem(key);
    if (!text) return null;
    text = AES.decrypt(text, CRYPT_KEY).toString(enc.Utf8);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const removeLocalStorageItem = (key: LocalStorageKey): void => {
  localStorage.removeItem(key);
};

export const clearLocalStorage = (): void => {
  localStorage.clear();
};
