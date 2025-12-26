import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ILoginRequest, IResetPasswordConfirmRequest, IUserOptions } from '@app/models';
import { ICurrentUser, IJwtTokens, ILoginResponse } from '@app/models';
import { Observable, delay, of } from 'rxjs';
import { Router } from '@angular/router';
import {
  API_URL,
  USER_OPTIONS_API_URL,
  LOGIN_API_URL,
  ME_API_URL,
  REFRESH_TOKEN_API_URL,
} from '@app/config';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  #http = inject(HttpClient);
  #router = inject(Router);

  /**
   * connecter l'utilisateur
   * @param {ILoginRequest} data
   * @return {ILoginResponse} - Contient accessToken, refreshToken et user partiel
   */
  login(data: ILoginRequest): Observable<ILoginResponse> {
    return this.#http.post<ILoginResponse>(`${LOGIN_API_URL}`, data)
  }

  /**
   * Récupérer l'utilisateur courant avec le token
   * @return Observable<ICurrentUser>
   */
  getCurrentUser(): Observable<ICurrentUser> {
    return this.#http.get<ICurrentUser>(`${ME_API_URL}`);
  }

  /**
   * Envoie une demande de réinitialisation du mot de passe d'un utilisateur.
   * @param {string} email
   * @returns {Observable<HttpResponse<void>>}
   */
  forgotPassword(email: string): Observable<HttpResponse<void>> {
    return this.#http.post<void>(
      `${API_URL}/password_reset`,
      { email },
      { observe: 'response' }
    );
  }

  /**
   * Vérifie la validité d'un token de réinitialisation de mot de passe.
   * @param {string} token
   * @returns {Observable<void>}
   */
  verifyResetPasswordToken(token: string): Observable<void> {
    return this.#http.post<void>(`${API_URL}/password_reset/verify`, {
      token,
    });
  }

  /**
   * Réinitialise le mot de passe de l'utilisateur en fonction des données de confirmation.
   * @param {IResetPasswordConfirmRequest} data
   * @returns {Observable<void>}
   */
  resetPassword(data: IResetPasswordConfirmRequest): Observable<void> {
    return this.#http.post<void>(`${API_URL}/password_reset/confirm`, data);
  }

  /**
   * récuperer un nouveau accessToken à l'aide du refreshToken
   * @param refreshToken
   * @return Observable<IJwtTokens>
   */
  refreshToken(refreshToken: string): Observable<IJwtTokens> {
    return this.#http.post<IJwtTokens>(`${REFRESH_TOKEN_API_URL}`, {
      refreshToken,
    }).pipe(map((response) => response));
  }

  /**
   * Redirige l'utilisateur vers une page d'authentification.
   * @param options.path - Le segment de chemin relatif à utiliser
   * @param options.redirectUrl
   */
  redirectToAuthPath(options?: { path?: string; redirectUrl?: string }): void {
    const path = options?.path ?? 'login';
    const redirectUrl = options?.redirectUrl;
    const loginPath = `/${path}`;
    void this.#router.navigate([loginPath], {
      queryParams: redirectUrl ? { redirectUrl } : undefined,
    });
  }

  /**
   * Récupère les options utilisateur (autorisations) pour le tenant courant
   * @returns Observable<IUserOptions> - Autorisations de l'utilisateur
   */
  getUserOptions(): Observable<IUserOptions> {
    // TODO: Remplacer par l'appel API réel quand le backend sera prêt
    // return this.#http.get<IUserOptions>(USER_OPTIONS_API_URL);

    // Mock temporaire avec autorisations uniquement
    return of({
      authorizations: [
        'CLIENTS_READ',
        'USERS_READ',
        'USERS_CREATE',
        'USERS_UPDATE',
      ],
    } as IUserOptions).pipe(delay(300));
  }
}
