import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../config/api.config';

export interface PointsHistory {
    id: string;
    clientId: string;
    points: number;
    type: 'EARN' | 'SPEND' | 'REFERRAL_BONUS' | 'ADJUSTMENT';
    date: string;
    description: string;
    factureId?: string;
    facture?: any;
}

@Injectable({
    providedIn: 'root'
})
export class LoyaltyService {
    private apiUrl = `${API_URL}/loyalty`;

    constructor(private http: HttpClient) { }

    getPointsBalance(clientId: string): Observable<number> {
        return this.http.get<number>(`${this.apiUrl}/balance/${clientId}`);
    }

    getPointsHistory(clientId: string): Observable<PointsHistory[]> {
        return this.http.get<PointsHistory[]>(`${this.apiUrl}/history/${clientId}`);
    }

    spendPoints(clientId: string, points: number, description: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/spend`, { clientId, points, description });
    }

    checkRewardEligibility(clientId: string): Observable<{ eligible: boolean; currentPoints: number; threshold: number }> {
        return this.http.get<{ eligible: boolean; currentPoints: number; threshold: number }>(`${this.apiUrl}/check-eligibility/${clientId}`);
    }

    redeemReward(clientId: string, rewardType: 'DISCOUNT' | 'MAD_BONUS'): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/redeem`, { clientId, rewardType });
    }

    getConfig(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/config`);
    }
}
