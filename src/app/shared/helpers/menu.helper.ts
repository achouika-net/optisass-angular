import { MenuItem } from '@app/models';
import { ResourceAuthorizations } from '@optisaas/opti-saas-lib';

/**
 * Filtre récursivement les items du menu selon les permissions utilisateur.
 * - Items sans authorizationsNeeded → visibles par tous
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

      // Vérifier les permissions pour cet item
      return hasRequiredAuthorizations(item.authorizationsNeeded, userAuthorizations) ? item : null;
    })
    .filter((item): item is MenuItem => item !== null);
}

/**
 * Vérifie si l'utilisateur a toutes les permissions requises.
 * @param required - Les permissions requises (undefined ou vide = pas de restriction)
 * @param userAuthorizations - Les permissions de l'utilisateur
 * @returns true si l'utilisateur a toutes les permissions requises
 */
function hasRequiredAuthorizations(
  required: ResourceAuthorizations[] | undefined,
  userAuthorizations: ResourceAuthorizations[]
): boolean {
  // Pas de permission requise = accessible à tous
  if (!required?.length) return true;
  // L'utilisateur doit avoir TOUTES les permissions requises
  return required.every((auth) => userAuthorizations.includes(auth));
}
