import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'environments/environment';
import { IAddressOption, IGeoapifyResponse, toAddressOption } from './geoapify-address.model';

const GEOAPIFY_AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';

@Injectable({ providedIn: 'root' })
export class GeoapifyAddressService {
  readonly #http = inject(HttpClient);

  /**
   * Vérifie si la clé API Geoapify est configurée
   * @returns true si la clé est configurée
   */
  get isApiConfigured(): boolean {
    return !!environment.geoapifyApiKey;
  }

  /**
   * Recherche des adresses via l'API Geoapify
   * Inclut toujours la saisie utilisateur comme dernière option
   * @param query - Texte de recherche
   * @param minLength - Longueur minimale pour déclencher la recherche
   * @param countryCode - Code pays pour filtrer les résultats (défaut: 'ma' pour Maroc)
   * @returns Observable des options d'adresses
   */
  searchAddresses(
    query: string | null | undefined,
    minLength = 3,
    countryCode = 'ma',
  ): Observable<IAddressOption[]> {
    // Defensive: ensure query is a string
    const queryStr = typeof query === 'string' ? query : '';
    if (!queryStr || queryStr.trim().length < minLength) {
      return of([]);
    }

    const userInputOption = this.#createUserInputOption(queryStr);

    // If no API key, return only user input
    if (!this.isApiConfigured) {
      return of([userInputOption]);
    }

    const params = {
      text: queryStr,
      apiKey: environment.geoapifyApiKey,
      filter: `countrycode:${countryCode}`,
      format: 'json',
      limit: '10',
    };

    return this.#http.get<IGeoapifyResponse>(GEOAPIFY_AUTOCOMPLETE_URL, { params }).pipe(
      map((response) => {
        const apiResults = response.results?.map(toAddressOption) || [];
        // Always add user input as last option
        return [...apiResults, userInputOption];
      }),
      // On error, return only user input
      catchError(() => of([userInputOption])),
    );
  }

  /**
   * Crée une option à partir de la saisie brute de l'utilisateur
   * @param query - Texte saisi par l'utilisateur
   * @returns Option d'adresse avec la saisie utilisateur
   */
  #createUserInputOption(query: string): IAddressOption {
    return {
      id: 'user-input',
      formatted: query,
    };
  }
}
