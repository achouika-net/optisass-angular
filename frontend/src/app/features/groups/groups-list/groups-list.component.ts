import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { GroupsService } from '../services/groups.service';
import { Groupe } from '../../../shared/interfaces/warehouse.interface';
import { GroupFormDialogComponent } from '../group-form-dialog/group-form-dialog.component';

@Component({
    selector: 'app-groups-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatDialogModule,
        MatMenuModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        ReactiveFormsModule,
    ],
    templateUrl: './groups-list.component.html',
    styleUrls: ['./groups-list.component.scss']
})
export class GroupsListComponent implements OnInit {
    displayedColumns: string[] = ['nom', 'description', 'ville', 'telephone', 'centresCount', 'actions'];
    groupes: Groupe[] = [];
    allGroupes: Groupe[] = []; // Store all groups for client-side filtering
    searchForm: FormGroup;
    loading = false;

    constructor(
        private groupsService: GroupsService,
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef,
        private fb: FormBuilder
    ) {
        this.searchForm = this.fb.group({
            nom: [''],
            adresse: [''],
            telephone: [''],
            email: ['']
        });
    }

    ngOnInit(): void {
        this.loadGroupes();
    }

    loadGroupes(): void {
        this.loading = true;
        this.groupsService.findAll().subscribe({
            next: (data) => {
                this.allGroupes = data;
                this.applyFilter(); // Apply current filters if any
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading groups:', err);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    onSearch(): void {
        this.applyFilter();
    }

    applyFilter(): void {
        const filters = this.searchForm.value;

        this.groupes = this.allGroupes.filter(groupe => {
            const matchesNom = !filters.nom || (groupe.nom || '').toLowerCase().includes(filters.nom.toLowerCase());
            const matchesAdresse = !filters.adresse || (groupe.adresse || '').toLowerCase().includes(filters.adresse.toLowerCase());
            const matchesPhone = !filters.telephone || (groupe.telephone || '').toLowerCase().includes(filters.telephone.toLowerCase());
            const matchesEmail = !filters.email || (groupe.email || '').toLowerCase().includes(filters.email.toLowerCase());

            return matchesNom && matchesAdresse && matchesPhone && matchesEmail;
        });
    }

    openCreateDialog(): void {
        const dialogRef = this.dialog.open(GroupFormDialogComponent, {
            width: '90vw',
            maxWidth: '1000px',
            data: null
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.loadGroupes();
            }
        });
    }

    openEditDialog(groupe: Groupe): void {
        const dialogRef = this.dialog.open(GroupFormDialogComponent, {
            width: '680px',
            maxWidth: '680px',
            data: groupe
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.loadGroupes();
            }
        });
    }

    deleteGroupe(id: string): void {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce groupe ? Tous les centres et entrepôts associés seront également supprimés.')) {
            this.groupsService.delete(id).subscribe({
                next: () => {
                    this.loadGroupes();
                },
                error: (err) => {
                    console.error('Error deleting group:', err);
                    alert('Erreur lors de la suppression du groupe');
                }
            });
        }
    }

    getCentresCount(groupe: Groupe): number {
        return groupe.centres?.length || 0;
    }
}
