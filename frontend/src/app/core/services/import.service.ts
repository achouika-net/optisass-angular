import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ImportService {
    private apiUrl = `${environment.apiUrl}/api/imports`;

    constructor(private http: HttpClient) { }

    uploadFile(file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post(`${this.apiUrl}/upload`, formData).pipe(
            tap((response) => {
                console.log('RAW HTTP Response from backend:', response);
                console.log('Response type:', typeof response);
                console.log('Is Array?:', Array.isArray(response));
                if (response && typeof response === 'object') {
                    console.log('Response keys:', Object.keys(response));
                }
            })
        );
    }

    executeImport(type: string, data: any[], mapping: any, warehouseId?: string, centreId?: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/execute`, {
            type,
            data,
            mapping,
            warehouseId,
            centreId
        });
    }
}
