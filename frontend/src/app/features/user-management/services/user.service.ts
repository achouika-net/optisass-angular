import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { User, UserFilters, UserStats, UserStatus, UserRole, Civilite, CentreRole } from '../../../shared/interfaces/user.interface';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private users: User[] = [];
    private usersSubject = new BehaviorSubject<User[]>([]);

    constructor() {
        this.initializeMockData();
    }

    /**
     * Initialize mock data for testing
     */
    private initializeMockData(): void {
        this.users = [
            {
                id: '1',
                nom: 'ABDOU',
                prenom: 'Sounouhadji',
                civilite: Civilite.MONSIEUR,
                telephone: '0765448568',
                email: 'testsssagaion',
                statut: UserStatus.ACTIF,
                centreRoles: [
                    { id: 'cr1', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.CENTRE },
                    { id: 'cr2', centreId: 'c2', centreName: 'ETAMPES', role: UserRole.CENTRE }
                ],
                createdAt: new Date('2024-01-15'),
                updatedAt: new Date('2024-01-15')
            },
            {
                id: '2',
                nom: 'ADOLFF',
                prenom: 'Frédéric',
                civilite: Civilite.MONSIEUR,
                email: 'test789456',
                statut: UserStatus.ACTIF,
                centreRoles: [
                    { id: 'cr3', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.CENTRE }
                ],
                createdAt: new Date('2024-02-10'),
                updatedAt: new Date('2024-02-10')
            },
            {
                id: '3',
                nom: 'AGENOR',
                prenom: 'Romain Erick',
                civilite: Civilite.MONSIEUR,
                email: 'trst8787789',
                statut: UserStatus.ACTIF,
                centreRoles: [
                    { id: 'cr4', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.CENTRE }
                ],
                createdAt: new Date('2024-03-05'),
                updatedAt: new Date('2024-03-05')
            },
            {
                id: '4',
                nom: 'ALIX',
                prenom: 'GEOFFROY ROBERT GEORGES',
                civilite: Civilite.MONSIEUR,
                email: 'test75012',
                agrement: '056D1240',
                statut: UserStatus.ACTIF,
                centreRoles: [
                    { id: 'cr5', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.GERANT }
                ],
                createdAt: new Date('2024-01-20'),
                updatedAt: new Date('2024-01-20')
            },
            {
                id: '5',
                nom: 'ALIX GEOFFROY',
                prenom: 'ALIX GEOFFROY',
                civilite: Civilite.MONSIEUR,
                email: 'tessst',
                statut: UserStatus.INACTIF,
                centreRoles: [
                    { id: 'cr6', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.COMPTABLE }
                ],
                createdAt: new Date('2024-02-15'),
                updatedAt: new Date('2024-02-15')
            },
            {
                id: '6',
                nom: 'FAMEL',
                prenom: 'Guillaume',
                civilite: Civilite.MONSIEUR,
                email: 'outosurdourdan@gmail.com',
                statut: UserStatus.ACTIF,
                centreRoles: [
                    { id: 'cr7', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.GERANT }
                ],
                createdAt: new Date('2024-03-10'),
                updatedAt: new Date('2024-03-10')
            },
            {
                id: '7',
                nom: 'FELTRI',
                prenom: 'Guillaume',
                civilite: Civilite.MONSIEUR,
                email: 'g.feltri3',
                statut: UserStatus.ACTIF,
                centreRoles: [
                    { id: 'cr8', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.GERANT }
                ],
                createdAt: new Date('2024-01-25'),
                updatedAt: new Date('2024-01-25')
            },
            {
                id: '8',
                nom: 'Goudoubert',
                prenom: 'Charlotte',
                civilite: Civilite.MADAME,
                email: 'test@Goudoubert.com',
                statut: UserStatus.ACTIF,
                centreRoles: [
                    { id: 'cr9', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.GERANT }
                ],
                createdAt: new Date('2024-02-20'),
                updatedAt: new Date('2024-02-20')
            },
            {
                id: '9',
                nom: 'GUILLON JEAN',
                prenom: 'GUILLON JEAN',
                civilite: Civilite.MONSIEUR,
                email: 'testok',
                statut: UserStatus.INACTIF,
                centreRoles: [
                    { id: 'cr10', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.CENTRE }
                ],
                createdAt: new Date('2024-03-15'),
                updatedAt: new Date('2024-03-15')
            },
            {
                id: '10',
                nom: 'laetitia',
                prenom: 'prigent',
                civilite: Civilite.MADAME,
                email: 'laetitia.prigent@cabinet-chiesa.fr',
                statut: UserStatus.ACTIF,
                centreRoles: [
                    { id: 'cr11', centreId: 'c1', centreName: 'DOURDAN', role: UserRole.COMPTABLE }
                ],
                createdAt: new Date('2024-01-30'),
                updatedAt: new Date('2024-01-30')
            }
        ];
        this.usersSubject.next(this.users);
    }

    /**
     * Get all users with optional filters
     */
    getUsers(filters?: UserFilters): Observable<User[]> {
        return this.usersSubject.pipe(
            map(users => {
                if (!filters) return users;

                return users.filter(user => {
                    if (filters.nom && !user.nom.toLowerCase().includes(filters.nom.toLowerCase())) {
                        return false;
                    }
                    if (filters.prenom && !user.prenom.toLowerCase().includes(filters.prenom.toLowerCase())) {
                        return false;
                    }
                    if (filters.agrement && !user.agrement?.toLowerCase().includes(filters.agrement.toLowerCase())) {
                        return false;
                    }
                    if (filters.statut && user.statut !== filters.statut) {
                        return false;
                    }
                    if (filters.role && !user.centreRoles.some(cr => cr.role === filters.role)) {
                        return false;
                    }
                    return true;
                });
            }),
            delay(300) // Simulate network delay
        );
    }

    /**
     * Get user by ID
     */
    getUserById(id: string): Observable<User | undefined> {
        return of(this.users.find(u => u.id === id)).pipe(delay(200));
    }

    /**
     * Create new user
     */
    createUser(userData: Partial<User>): Observable<User> {
        const newUser: User = {
            id: this.generateId(),
            nom: userData.nom || '',
            prenom: userData.prenom || '',
            civilite: userData.civilite || Civilite.MONSIEUR,
            telephone: userData.telephone,
            email: userData.email || '',
            agrement: userData.agrement,
            statut: userData.statut || UserStatus.ACTIF,
            centreRoles: userData.centreRoles || [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.users.push(newUser);
        this.usersSubject.next(this.users);
        return of(newUser).pipe(delay(300));
    }

    /**
     * Update existing user
     */
    updateUser(id: string, userData: Partial<User>): Observable<User> {
        const index = this.users.findIndex(u => u.id === id);
        if (index === -1) {
            throw new Error('User not found');
        }

        this.users[index] = {
            ...this.users[index],
            ...userData,
            id, // Preserve ID
            updatedAt: new Date()
        };

        this.usersSubject.next(this.users);
        return of(this.users[index]).pipe(delay(300));
    }

    /**
     * Delete user
     */
    deleteUser(id: string): Observable<void> {
        this.users = this.users.filter(u => u.id !== id);
        this.usersSubject.next(this.users);
        return of(void 0).pipe(delay(200));
    }

    /**
     * Get user statistics
     */
    getUserStats(): Observable<UserStats> {
        const stats: UserStats = {
            totalUsers: this.users.length,
            activeUsers: this.users.filter(u => u.statut === UserStatus.ACTIF).length,
            inactiveUsers: this.users.filter(u => u.statut === UserStatus.INACTIF).length,
            usersByRole: {}
        };

        // Count users by role
        this.users.forEach(user => {
            user.centreRoles.forEach(cr => {
                stats.usersByRole[cr.role] = (stats.usersByRole[cr.role] || 0) + 1;
            });
        });

        return of(stats).pipe(delay(200));
    }

    /**
     * Export users to PDF
     */
    exportUsersPDF(): void {
        // TODO: Implement PDF export functionality
        console.log('Exporting users to PDF...');
        alert('Export PDF functionality will be implemented');
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}
