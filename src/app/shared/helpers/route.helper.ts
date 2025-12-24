import { IClientRoute } from '@optisaas/opti-saas-lib';

/**
 * Recherche une route à partir d'une URL.
 * @param routes La liste des routes client
 * @param url L'URL actuelle
 * @returns La route `IClientRoute` correspondante | null
 */
export const findRouteByUrl = (
  routes: IClientRoute[],
  url: string
): IClientRoute | null => {
  const segments = url.replace(/^\/+/, '').replace(/^p\//, '').split('/');

  let currentLevel = routes;

  for (const segment of segments) {
    const match = currentLevel.find((route) => {
      // Pour les routes de type 'link' ou 'collapse-link', on vérifie le path
      if (route.type === 'link' || route.type === 'collapse-link') {
        const routePath = route.path?.replace(/^\/+/, '').split('/').at(-1);
        return routePath === segment;
      }
      return false;
    });

    if (!match) return null;
    if (segment === segments.at(-1)) return match;

    // Descendre dans les enfants si c'est un collapse
    if (match.type === 'collapse' || match.type === 'sous-collapse') {
      currentLevel = match.children ?? [];
    } else {
      return null;
    }
  }

  return null;
};
