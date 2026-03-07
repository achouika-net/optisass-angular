import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IStockEntryRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class StockEntryService {
  readonly #http = inject(HttpClient);

  /**
   * Creates a new stock entry.
   * @param request The stock entry request
   * @returns Observable that completes when created
   */
  createEntry(request: IStockEntryRequest): Observable<void> {
    return this.#http.post<void>('/api/stock/entries', request);
  }
}
