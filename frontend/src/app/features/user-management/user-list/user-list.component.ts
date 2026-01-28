import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { UserService } from '../services/user.service';
import { User, UserFilters, UserStatus, UserRole } from '../../../shared/interfaces/user.interface';

@Component({
    selector: 'app-user-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatCardModule,
        MatDialogModule,
        MatMenuModule,
        MatDividerModule
    ],
    templateUrl: './user-list.component.html',
    styleUrls: ['./user-list.component.scss']
})
export class UserListComponent implements OnInit {
    displayedColumns: string[] = ['nom', 'prenom', 'email', 'matricule', 'personnel', 'role', 'statut', 'actions'];
    dataSource: MatTableDataSource<User>;

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    // Filters - Initialize with empty string to show "Tous" by default
    filter: UserFilters = {
        statut: '' as any,
        role: '' as any
    };

    // Enums for dropdowns
    userStatuses = Object.values(UserStatus);
    userRoles = Object.values(UserRole);

    constructor(
        private userService: UserService,
        private dialog: MatDialog
    ) {
        this.dataSource = new MatTableDataSource<User>([]);
    }

    ngOnInit(): void {
        this.loadUsers();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    /**
     * Load users from service
     */
    loadUsers(): void {
        this.userService.getUsers(this.filter).subscribe((users: User[]) => {
            this.dataSource.data = users;
        });
    }

    /**
     * Apply filters
     */
    applyFilter(): void {
        this.loadUsers();
    }

    /**
     * Reset filters
     */
    resetFilters(): void {
        this.filter = {
            statut: '' as any,
            role: '' as any
        };
        this.loadUsers();
    }

    /**
     * Get user's primary role for display
     */
    getUserRole(user: User): string {
        if (user.centreRoles.length === 0) return '--';
        return user.centreRoles[0].role;
    }

    /**
     * Get status class for styling
     */
    getStatusClass(statut: UserStatus): string {
        return statut === UserStatus.ACTIF ? 'status-actif' : 'status-inactif';
    }

    /**
     * Delete user with confirmation
     */
    deleteUser(user: User): void {
        const confirmMsg = "Êtes-vous sûr de vouloir supprimer l'utilisateur " + user.prenom + " " + user.nom + " ?";
        if (confirm(confirmMsg)) {
            this.userService.deleteUser(user.id).subscribe(() => {
                this.loadUsers();
            });
        }
    }

    /**
     * Export users to PDF
     */
    exportPDF(): void {
        this.userService.exportUsersPDF();
    }
}
