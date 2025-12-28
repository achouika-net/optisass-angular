import { MenuItem } from '@app/models';
import { ResourceAuthorizations } from '@optisaas/opti-saas-lib';
import { isRouteAuthorized } from './route-auth.helper';

/**
 * Filtre récursivement les items du menu selon les permissions utilisateur.
 * - Items sans route ou route sans permissions → visibles par tous
 * - Sub menus → visibles seulement s'ils ont au moins 1 enfant autorisé
 * @param items - Les items du menu à filtrer
 * @param userAuthorizations - Les permissions de l'utilisateur
 * @returns Les items filtrés selon les permissions
 */
export function filterMenuByAuthorizations(
  items: MenuItem[],
  userAuthorizations: ResourceAuthorizations[]
): MenuItem[] {
  return items
    .map((item) => {
      // Sub avec enfants : filtrer les enfants d'abord
      if (item.type === 'sub' && item.children?.length) {
        const filteredChildren = filterMenuByAuthorizations(item.children, userAuthorizations);
        // Garder le parent seulement s'il a des enfants autorisés
        return filteredChildren.length > 0 ? { ...item, children: filteredChildren } : null;
      }

      // Vérifier les permissions pour cet item via isRouteAuthorized (fonction partagée)
      return isRouteAuthorized(item.route, userAuthorizations) ? item : null;
    })
    .filter((item): item is MenuItem => item !== null);
}
