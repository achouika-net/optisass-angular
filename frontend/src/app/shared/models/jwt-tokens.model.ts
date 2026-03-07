export interface IJwtTokens {
  accessToken: string;
  refreshToken: string;
}

export type JwtTokensState = IJwtTokens | null;

export const INITIAL_JWT_TOKENS: JwtTokensState = null;

/**
 * Vérifie si les tokens sont valides et non-null
 * @param tokens - Les tokens JWT à vérifier
 * @returns true si les tokens sont valides, false sinon
 */
export function isValidTokens(tokens: JwtTokensState): tokens is IJwtTokens {
  return (
    tokens !== null &&
    typeof tokens.accessToken === 'string' &&
    tokens.accessToken.length > 0 &&
    typeof tokens.refreshToken === 'string' &&
    tokens.refreshToken.length > 0
  );
}
