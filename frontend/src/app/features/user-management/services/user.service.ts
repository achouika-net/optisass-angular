import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User, UserFilters, UserStats } from '../../../shared/interfaces/user.interface';
import { USERS_API_URL } from '@app/config';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private http = inject(HttpClient);
    private apiUrl = USERS_API_URL;

    constructor() { }

    /**
     * Get all users with optional filters
     */
    getUsers(filters?: UserFilters): Observable<User[]> {
        let params = new HttpParams();
        if (filters) {
            if (filters.nom) params = params.set('nom', filters.nom);
            if (filters.prenom) params = params.set('prenom', filters.prenom);
            if (filters.matricule) params = params.set('matricule', filters.matricule);
            if (filters.statut) params = params.set('statut', filters.statut);
            if (filters.role) params = params.set('role', filters.role);
        }
        return this.http.get<User[]>(this.apiUrl, { params });
    }

    /**
     * Get user by ID
     */
    getUserById(id: string): Observable<User | undefined> {
        return this.http.get<User>(`${this.apiUrl}/${id}`);
    }

    /**
     * Create new user
     */
    createUser(userData: Partial<User>): Observable<User> {
        return this.http.post<User>(this.apiUrl, userData);
    }

    /**
     * Update existing user
     */
    updateUser(id: string, userData: Partial<User>): Observable<User> {
        return this.http.patch<User>(`${this.apiUrl}/${id}`, userData);
    }

    /**
     * Delete user
     */
    deleteUser(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    /**
     * Get user statistics
     */
    getUserStats(): Observable<UserStats> {
        return this.getUsers().pipe(
            map(users => {
                const stats: UserStats = {
                    totalUsers: users.length,
                    activeUsers: users.filter(u => u.statut === 'actif').length,
                    inactiveUsers: users.filter(u => u.statut === 'inactif').length,
                    usersByRole: {}
                };

                users.forEach(user => {
                    user.centreRoles?.forEach(cr => {
                        stats.usersByRole[cr.role] = (stats.usersByRole[cr.role] || 0) + 1;
                    });
                });

                return stats;
            })
        );
    }

    /**
     * Export users to PDF
     */
    exportUsersPDF(): void {
        console.log('Exporting users to PDF...');
        alert('Export PDF functionality will be implemented');
    }
}
