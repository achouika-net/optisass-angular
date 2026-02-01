import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../../config/api.config';
import {
    OperationCaisse,
    CreateOperationCaisseDto,
    OperationStats,
} from '../models/caisse.model';

@Injectable({
    providedIn: 'root',
})
export class OperationCaisseService {
    private apiUrl = `${API_URL}/operation-caisse`;

    constructor(private http: HttpClient) { }

    create(
        createOperationDto: CreateOperationCaisseDto,
        userRole?: string
    ): Observable<OperationCaisse> {
        let params = new HttpParams();
        if (userRole) {
            params = params.set('userRole', userRole);
        }
        return this.http.post<OperationCaisse>(this.apiUrl, createOperationDto, { params });
    }

    findByJournee(journeeId: string, startDate?: string, endDate?: string): Observable<OperationCaisse[]> {
        let params = new HttpParams().set('_t', Date.now().toString());
        if (startDate && startDate !== 'undefined') params = params.set('startDate', startDate);
        if (endDate && endDate !== 'undefined') params = params.set('endDate', endDate);
        return this.http.get<OperationCaisse[]>(`${this.apiUrl}/journee/${journeeId}`, { params });
    }

    getStatsByJournee(journeeId: string): Observable<OperationStats> {
        return this.http.get<OperationStats>(`${this.apiUrl}/journee/${journeeId}/stats`);
    }

    remove(id: string, userRole?: string): Observable<void> {
        let params = new HttpParams();
        if (userRole) {
            params = params.set('userRole', userRole);
        }
        return this.http.delete<void>(`${this.apiUrl}/${id}`, { params });
    }

    transfer(dto: {
        amount: number;
        fromJourneeId: string;
        toJourneeId: string;
        utilisateur: string;
    }): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/transfer`, dto);
    }
}
