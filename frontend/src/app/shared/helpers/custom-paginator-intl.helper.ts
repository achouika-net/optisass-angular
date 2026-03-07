import { Injectable, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

@Injectable()
export class CustomPaginatorIntl implements MatPaginatorIntl {
  #translate = inject(TranslateService);

  changes = new Subject<void>();

  // Change labels of Mat-paginator
  firstPageLabel = this.#translate.instant('table.firstPage');
  itemsPerPageLabel = this.#translate.instant('table.itemsPerPage');
  lastPageLabel = this.#translate.instant('table.lastPage');
  nextPageLabel = this.#translate.instant('table.nextPage');
  previousPageLabel = this.#translate.instant('table.previousPage');

  /**
   * get a label for the range of items within
   * the current page and the length of the whole list
   * @param page number
   * @param pageSize number
   * @param length number
   * @return string
   */
  getRangeLabel(page: number, pageSize: number, length: number): string {
    if (length === 0) {
      return this.#translate.instant('table.pageOf', {
        page: 1,
        amountPages: 1,
      });
    }
    const amountPages = Math.ceil(length / pageSize);
    return this.#translate.instant('table.pageOf', {
      page: page + 1,
      amountPages,
    });
  }
}
