import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_ADDRESS_URL } from '@app/config';
import { Observable } from 'rxjs/internal/Observable';
import { IAddress } from './address.model';
import { of } from 'rxjs';

export class AddressService {
  #http = inject(HttpClient);

  searchAdress(filter: string): Observable<IAddress[]> {
    if (!filter) {
      return of([]);
    }
    return this.#http.get<IAddress[]>(
      `${API_ADDRESS_URL}/search?adresse=${filter}`
    );
  }
}
