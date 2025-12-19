import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Groupe } from '../../../shared/interfaces/warehouse.interface';
import { API_URL } from '../../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class GroupsService {
    private apiUrl = `${API_URL}/groups`;

    constructor(private http: HttpClient) { }

    create(groupe: Partial<Groupe>): Observable<Groupe> {
        return this.http.post<Groupe>(this.apiUrl, groupe);
    }

    findAll(): Observable<Groupe[]> {
        return this.http.get<Groupe[]>(this.apiUrl);
    }

    findOne(id: string): Observable<Groupe> {
        return this.http.get<Groupe>(`${this.apiUrl}/${id}`);
    }

    update(id: string, groupe: Partial<Groupe>): Observable<Groupe> {
        return this.http.patch<Groupe>(`${this.apiUrl}/${id}`, groupe);
    }

    delete(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }
}
