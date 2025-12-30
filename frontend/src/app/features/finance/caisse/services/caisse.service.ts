import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../../config/api.config';
import { Caisse, CreateCaisseDto, UpdateCaisseDto } from '../models/caisse.model';

@Injectable({
    providedIn: 'root',
})
export class CaisseService {
    private apiUrl = `${API_URL}/caisse`;

    constructor(private http: HttpClient) { }

    create(createCaisseDto: CreateCaisseDto): Observable<Caisse> {
        return this.http.post<Caisse>(this.apiUrl, createCaisseDto);
    }

    findAll(): Observable<Caisse[]> {
        return this.http.get<Caisse[]>(this.apiUrl);
    }

    findOne(id: string): Observable<Caisse> {
        return this.http.get<Caisse>(`${this.apiUrl}/${id}`);
    }

    findByCentre(centreId: string): Observable<Caisse[]> {
        return this.http.get<Caisse[]>(`${this.apiUrl}/centre/${centreId}`);
    }

    update(id: string, updateCaisseDto: UpdateCaisseDto): Observable<Caisse> {
        return this.http.patch<Caisse>(`${this.apiUrl}/${id}`, updateCaisseDto);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    remove(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}
