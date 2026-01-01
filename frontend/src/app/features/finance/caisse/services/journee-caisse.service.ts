import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../../config/api.config';
import {
    JourneeCaisse,
    OuvrirCaisseDto,
    CloturerCaisseDto,
    JourneeResume,
} from '../models/caisse.model';

@Injectable({
    providedIn: 'root',
})
export class JourneeCaisseService {
    private apiUrl = `${API_URL}/journee-caisse`;

    constructor(private http: HttpClient) { }

    ouvrir(ouvrirCaisseDto: OuvrirCaisseDto): Observable<JourneeCaisse> {
        return this.http.post<JourneeCaisse>(`${this.apiUrl}/ouvrir`, ouvrirCaisseDto);
    }

    cloturer(id: string, cloturerCaisseDto: CloturerCaisseDto): Observable<JourneeCaisse> {
        return this.http.post<JourneeCaisse>(`${this.apiUrl}/${id}/cloturer`, cloturerCaisseDto);
    }

    findOne(id: string): Observable<JourneeCaisse> {
        return this.http.get<JourneeCaisse>(`${this.apiUrl}/${id}`);
    }

    getActiveByCaisse(caisseId: string): Observable<JourneeCaisse> {
        return this.http.get<JourneeCaisse>(`${this.apiUrl}/caisse/${caisseId}/active`);
    }

    findByCentre(centreId: string): Observable<JourneeCaisse[]> {
        return this.http.get<JourneeCaisse[]>(`${this.apiUrl}/centre/${centreId}`);
    }

    findHistory(centreId: string): Observable<JourneeCaisse[]> {
        return this.http.get<JourneeCaisse[]>(`${this.apiUrl}/centre/${centreId}/history`);
    }

    getResume(id: string): Observable<JourneeResume> {
        return this.http.get<JourneeResume>(`${this.apiUrl}/${id}/resume`);
    }
}
