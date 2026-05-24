import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BanqueService {
  private apiUrl = ${environment.apiUrl}/banque;

  constructor(private http: HttpClient) {}

  getComptes(): Observable<any> {
    return this.http.get(${this.apiUrl}/comptes);
  }

  createCompte(data: any): Observable<any> {
    return this.http.post(${this.apiUrl}/comptes, data);
  }

  importReleve(compteId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('compteId', compteId);
    return this.http.post(${this.apiUrl}/releves/import, formData);
  }

  getRapprochement(): Observable<any> {
    return this.http.get(${this.apiUrl}/rapprochement);
  }

  validerRapprochement(transactionId: string, typeMatched: string, matchedId: string): Observable<any> {
    return this.http.post(${this.apiUrl}/rapprochement/valider, { transactionId, typeMatched, matchedId });
  }
}
