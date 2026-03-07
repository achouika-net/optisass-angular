import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { IWsError, createWsError } from '@app/models';

@Injectable({ providedIn: 'root' })
export class ErrorService {
  #translate = inject(TranslateService);
  #toastr = inject(ToastrService);

  /**
   * Crée et retourne une erreur IWsError
   */
  getError(
    error: HttpErrorResponse,
    errorMessage?: string,
    showToastr = false,
    byTranslate = true
  ): IWsError {
    const iWsError: IWsError = createWsError(error);
    const messageToShow = byTranslate ? this.#translate.instant(errorMessage) : errorMessage;
    if (showToastr) {
      this.#toastr.error(messageToShow);
    }
    return { ...iWsError, messageToShow };
  }
}
