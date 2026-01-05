import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
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
import { MatChipsModule } from '@angular/material/chips';

import { PersonnelService } from '../services/personnel.service';
import { Employee } from '../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-employee-list',
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
        MatDividerModule,
        MatChipsModule
    ],
    templateUrl: './employee-list.component.html',
    styleUrls: ['./employee-list.component.scss']
})
export class EmployeeListComponent implements OnInit, AfterViewInit {
    displayedColumns: string[] = ['matricule', 'nom', 'prenom', 'poste', 'contrat', 'salaireBase', 'statut', 'actions'];
    dataSource: MatTableDataSource<Employee>;

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    filter: any = {
        centreId: '',
        statut: ''
    };

    constructor(
        private personnelService: PersonnelService,
        private dialog: MatDialog
    ) {
        this.dataSource = new MatTableDataSource<Employee>([]);
    }

    ngOnInit(): void {
        this.loadEmployees();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadEmployees(): void {
        this.personnelService.getEmployees(this.filter.centreId).subscribe(employees => {
            this.dataSource.data = employees;
        });
    }

    applyFilter(): void {
        this.loadEmployees();
    }

    resetFilters(): void {
        this.filter = { centreId: '', statut: '' };
        this.loadEmployees();
    }

    deleteEmployee(employee: Employee): void {
        if (confirm(`Êtes-vous sûr de vouloir supprimer l'employé ${employee.nom} ${employee.prenom} ?`)) {
            this.personnelService.deleteEmployee(employee.id!).subscribe(() => {
                this.loadEmployees();
            });
        }
    }

    getStatusClass(statut: string): string {
        switch (statut) {
            case 'ACTIF': return 'status-active';
            case 'SUSPENDU': return 'status-suspended';
            case 'SORTI': return 'status-left';
            default: return '';
        }
    }
}
