import { MenuItem } from '@app/models';
import { UserRole } from '@app/types';

/**
 * Recherche un élément de menu à partir d'une URL.
 * @param items La liste des menus.
 * @param url L'URL actuelle.
 * @returns L'élément `MenuItem` correspondant | null.
 */
export const findMenuItemByUrl = (
  items: MenuItem[],
  url: string
): MenuItem | null => {
  const segments = url.replace(/^\/+/, '').replace(/^p\//, '').split('/');

  let currentLevel = items;

  for (const segment of segments) {
    const match = currentLevel.find((item) => {
      const itemRoute = item.route?.replace(/^\/+/, '').split('/').at(-1);
      return itemRoute === segment;
    });

    if (!match) return null;
    if (segment === segments.at(-1)) return match;

    currentLevel = match.children ?? [];
  }

  return null;
};

/**
 * Vérifie si l’utilisateur a accès à un item donné.
 * @param item Élément de menu.
 * @param role user roles
 * @returns `true` si l’élément est visible pour l’utilisateur.
 */
export const userHasAccessToItem = (
  item: MenuItem,
  role: UserRole
): boolean => {
  if (!item?.roles || item?.roles.length === 0) return true;
  return item.roles.includes(role);
};

/**
 * Extrait le module le plus profond depuis une URL en cherchant dans le menu
 * Parcourt les segments de l'URL du plus profond au plus superficiel
 * @param items La liste des menus
 * @param url L'URL complète
 * @returns Le MenuItem trouvé dans le menu | null
 */
export const extractDeepestModuleFromUrl = (
  items: MenuItem[],
  url: string
): MenuItem | null => {
  if (!url) return null;
  const segments = url.replace(/^\/+/, '').replace(/^p\//, '').split('/');
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    if (segment && !segment.match(/^\d+$/) && !segment.includes('?')) {
      const partialUrl = segments.slice(0, i + 1).join('/');
      const menuItem = findMenuItemByUrl(items, partialUrl);
      if (menuItem) {
        return menuItem;
      }
    }
  }

  return null;
};
