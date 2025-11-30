import { inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { LOCAL_STORAGE_KEYS, MAX_HISTORY } from '@app/config';
import {
  getLocalStorageItem,
  removeLocalStorageItem,
  setLocalStorageItem,
} from '@app/helpers';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);

  // Signal pour stocker l’historique localement (réactif)
  private readonly history = signal<string[]>(this.loadFromStorage());

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => {
        this.push(event.urlAfterRedirects);
      });
  }

  /**
   * Ajoute une nouvelle URL à l’historique.
   * Évite les doublons consécutifs et limite à MAX_HISTORY.
   * @param url URL visitée
   */
  private push(url: string): void {
    // Ignorer les URLs techniques comme 'redirection'
    if (url.includes('/redirection')) return;
    const current = this.history();
    if (current.at(-1) === url) return;

    const updated = [...current, url];
    if (updated.length > MAX_HISTORY) updated.shift();

    this.history.set(updated);
    this.saveToStorage(updated);
  }

  /**
   * Récupère l’historique complet.
   * @returns Liste des URLs visitées.
   */
  getHistory(): string[] {
    return this.history();
  }

  /**
   * Récupère l’URL précédente.
   * @returns URL précédente ou null si indisponible.
   */
  getPreviousUrl(): string | null {
    const h = this.history();
    return h.length >= 2 ? h[h.length - 2] : null;
  }

  /**
   * Navigue vers l’URL précédente si disponible.
   * @returns true si navigation effectuée, false sinon.
   */
  goBack(): boolean {
    const previous = this.getPreviousUrl();
    if (previous) {
      this.router.navigateByUrl(previous);
      return true;
    }
    return false;
  }

  /**
   * Réinitialise l’historique (en mémoire et en localStorage).
   */
  clear(): void {
    this.history.set([]);
    removeLocalStorageItem(LOCAL_STORAGE_KEYS.APP.NAVIGATION_HISTORY);
  }

  /**
   * Charge l’historique depuis le localStorage (déchiffré).
   * @returns Historique ou tableau vide.
   */
  private loadFromStorage(): string[] {
    const stored = getLocalStorageItem(
      LOCAL_STORAGE_KEYS.APP.NAVIGATION_HISTORY
    );
    return Array.isArray(stored) ? stored : [];
  }

  /**
   * Sauvegarde l’historique dans le localStorage (chiffré).
   * @param history Liste des URLs
   */
  private saveToStorage(history: string[]): void {
    setLocalStorageItem(LOCAL_STORAGE_KEYS.APP.NAVIGATION_HISTORY, history);
  }
}
