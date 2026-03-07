import { Injectable } from '@angular/core';
import { LOCAL_STORAGE_KEYS } from '@app/config';

interface StorageMetadata {
  version: number;
  timestamp: number;
}

interface StorageEntry<T> {
  data: T;
  metadata: StorageMetadata;
}

type StoreKey = keyof typeof LOCAL_STORAGE_KEYS.STORE;

@Injectable({ providedIn: 'root' })
export class StatePersistenceService {
  private readonly VERSION = 1;

  /**
   * Récupère une valeur du localStorage avec gestion d'erreur et vérification de version
   */
  get<T>(key: StoreKey): T | null {
    try {
      const storageKey = LOCAL_STORAGE_KEYS.STORE[key];
      const item = localStorage.getItem(storageKey);
      if (!item) return null;

      const entry: StorageEntry<T> = JSON.parse(item);

      if (entry.metadata.version !== this.VERSION) {
        console.warn(`State version mismatch for ${key}, clearing...`);
        this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return null;
    }
  }

  /**
   * Sauvegarde une valeur dans localStorage avec métadonnées
   */
  set<T>(key: StoreKey, value: T): void {
    try {
      const storageKey = LOCAL_STORAGE_KEYS.STORE[key];
      const entry: StorageEntry<T> = {
        data: value,
        metadata: {
          version: this.VERSION,
          timestamp: Date.now(),
        },
      };
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  }

  /**
   * Supprime une valeur du localStorage
   */
  remove(key: StoreKey): void {
    try {
      const storageKey = LOCAL_STORAGE_KEYS.STORE[key];
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  }

  /**
   * Vide tout le localStorage des stores
   */
  clear(): void {
    try {
      Object.values(LOCAL_STORAGE_KEYS.STORE).forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }
}
