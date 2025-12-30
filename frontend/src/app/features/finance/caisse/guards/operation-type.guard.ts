import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class OperationTypeGuard implements CanActivate {
    constructor() { }

    canActivate(): Observable<boolean> {
        // TODO: Implement actual authentication service check
        // For now, we'll check localStorage for user role
        const userRole = localStorage.getItem('userRole');

        const authorizedRoles = ['RESPONSABLE', 'DIRECTION', 'ADMIN'];
        const hasAccess = userRole && authorizedRoles.includes(userRole);

        return of(hasAccess);
    }

    /**
     * Check if current user can create INTERNE operations
     */
    canCreateInterneOperation(): boolean {
        const userRole = localStorage.getItem('userRole');
        const authorizedRoles = ['RESPONSABLE', 'DIRECTION', 'ADMIN'];
        return userRole ? authorizedRoles.includes(userRole) : false;
    }

    /**
     * Get current user role
     */
    getUserRole(): string | null {
        return localStorage.getItem('userRole');
    }
}
