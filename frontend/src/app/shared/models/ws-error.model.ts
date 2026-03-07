import { HttpErrorResponse } from '@angular/common/http';

export interface IWsError {
  status?: number | null;
  message?: string | null;
  messageToShow?: string | null;
}

export type WsErrorState = IWsError | null;

export const INITIAL_WS_ERROR: WsErrorState = null;

/**
 * Crée un objet IWsError à partir d'une HttpErrorResponse
 * @param error - L'erreur HTTP à transformer (optionnel)
 * @returns Un objet IWsError
 */
export function createWsError(error: HttpErrorResponse | null = null): IWsError {
  return {
    status: error?.status ?? null,
    message: error?.message ?? null,
    messageToShow: null,
  };
}

/**
 * Crée un WsError avec un message personnalisé
 * @param error - L'erreur HTTP source
 * @param messageToShow - Le message à afficher à l'utilisateur
 * @returns Un objet IWsError avec le message personnalisé
 */
export function createWsErrorWithMessage(
  error: HttpErrorResponse,
  messageToShow: string
): IWsError {
  return {
    status: error.status,
    message: error.message,
    messageToShow,
  };
}
