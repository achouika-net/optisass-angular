/**
 * Vérifie si une URL correspond à une route de login (même avec query params ou fragments).
 * @param url URL
 * @returns `true` si l’URL se termine bien par `/login`, `false` sinon.
 */
export function isLoginUrl(url: string): boolean {
  const cleanUrl = url.split('?')[0].split('#')[0];
  return cleanUrl.endsWith('/login');
}
