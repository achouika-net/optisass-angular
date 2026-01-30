import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { ResourceAuthorizations } from '@app/models';
import { calculateFallbackRoute } from '@app/helpers';

/**
 * Service d'orchestration pour la gestion des autorisations de route.
 * Combine les helpers purs avec les services Angular (Router, Toast, Translate).
 *
 * Utilisé par :
 * - permission.guard.ts : pour rediriger lors de navigation non autorisée
 * - auth.store.ts : pour gérer le changement de tenant
 */
@Injectable({ providedIn: 'root' })
export class RouteAuthService {
  readonly #router = inject(Router);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);

  /**
   * Obtient l'URL courante du router.
   */
  getCurrentUrl(): string {
    return this.#router.url;
  }

  /**
   * Calcule et navigue vers la route de fallback appropriée.
   * Affiche un toast d'avertissement AVANT la navigation.
   *
   * @param userAuthorizations - Les autorisations actuelles de l'utilisateur
   * @returns true si une navigation a eu lieu, false sinon
   */
  navigateToFallback(userAuthorizations: ResourceAuthorizations[]): boolean {
    const fallbackRoute = calculateFallbackRoute(this.#router.url, userAuthorizations);

    if (fallbackRoute) {
      this.#navigateWithWarning(fallbackRoute);
      return true;
    }

    return false;
  }

  /**
   * Navigue vers une route de fallback pré-calculée avec toast.
   * Utilisé par switchTenant quand le fallback est déjà connu.
   */
  navigateToFallbackRoute(fallbackRoute: string): void {
    this.#navigateWithWarning(fallbackRoute);
  }

  /**
   * Affiche un toast de succès pour le changement de tenant.
   */
  showTenantSwitchSuccess(): void {
    this.#toastr.success(this.#translate.instant('tenant.switched'));
  }

  /**
   * Affiche un toast d'erreur pour l'échec du changement de tenant.
   */
  showTenantSwitchError(): void {
    this.#toastr.error(this.#translate.instant('tenant.switchError'));
  }

  /**
   * Navigue vers une route avec un toast d'avertissement.
   * Toast affiché AVANT navigation pour éviter l'annulation par le changement de route.
   */
  #navigateWithWarning(route: string): void {
    this.#toastr.warning(this.#translate.instant('permissions.noAccessToModule'));
    void this.#router.navigate([route]);
  }
}
