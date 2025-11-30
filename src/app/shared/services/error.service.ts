import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { IWsError, WsErrorClass } from '../models';

@Injectable({ providedIn: 'root' })
export class ErrorService {
  #translate = inject(TranslateService);
  #toastr = inject(ToastrService);

  /**
   * Create and return the IWsError
   * @param {HttpErrorResponse} error - The HTTP error response
   * @param {string} errorMessage - The error message to display
   * @param {boolean} showToastr - Whether to show a toast notification
   * @param {boolean} byTranslate - Whether to translate the error message
   */
  getError(
    error: HttpErrorResponse,
    errorMessage?: string,
    showToastr = false,
    byTranslate = true
  ): IWsError {
    const iWsError: IWsError = new WsErrorClass(error);
    const messageToShow = byTranslate ? this.#translate.instant(errorMessage) : errorMessage;
    if (showToastr) {
      this.#toastr.error(messageToShow);
    }
    return { ...iWsError, messageToShow };
  }
}
