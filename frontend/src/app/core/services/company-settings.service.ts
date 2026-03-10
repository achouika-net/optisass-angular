import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompanySettings } from '../../shared/interfaces/company-settings.interface';
import { API_URL } from '../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class CompanySettingsService {
    private apiUrl = `${API_URL}/company-settings`;

    constructor(private http: HttpClient) { }

    getSettings(): Observable<CompanySettings> {
        return this.http.get<CompanySettings>(this.apiUrl);
    }

    updateSettings(settings: Partial<CompanySettings>): Observable<CompanySettings> {
        return this.http.patch<CompanySettings>(this.apiUrl, settings);
    }
}
