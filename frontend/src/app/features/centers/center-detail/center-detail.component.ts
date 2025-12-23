import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CentersService } from '../services/centers.service';
import { Centre } from '../../../shared/interfaces/warehouse.interface';
import { WarehouseFormDialogComponent } from '../../warehouses/warehouse-form-dialog/warehouse-form-dialog.component';
import { WarehousesService } from '../../warehouses/services/warehouses.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
    selector: 'app-center-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatDialogModule,
        MatSnackBarModule
    ],
    templateUrl: './center-detail.component.html',
    styleUrls: ['./center-detail.component.scss']
})
export class CenterDetailComponent implements OnInit {
    centre: Centre | null = null;
    loading = false;
    displayedColumns: string[] = ['nom', 'type', 'capaciteMax', 'actions'];

    constructor(
        private route: ActivatedRoute,
        private centersService: CentersService,
        private warehousesService: WarehousesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadCentre(id);
        }
    }

    loadCentre(id: string): void {
        this.loading = true;
        this.centersService.findOne(id).subscribe({
            next: (data: Centre) => {
                this.centre = data;
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err: any) => {
                console.error('Error loading center:', err);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    openCreateWarehouseDialog(): void {
        if (!this.centre?.id) return;

        const dialogRef = this.dialog.open(WarehouseFormDialogComponent, {
            width: '90vw',
            maxWidth: '1000px',
            data: { entrepot: null, centreId: this.centre.id }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && this.centre?.id) {
                this.loadCentre(this.centre.id);
            }
        });
    }

    openEditWarehouseDialog(entrepot: any): void {
        const dialogRef = this.dialog.open(WarehouseFormDialogComponent, {
            width: '90vw',
            maxWidth: '1000px',
            data: { entrepot: entrepot, centreId: this.centre?.id }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && this.centre?.id) {
                this.loadCentre(this.centre.id);
            }
        });
    }

    deleteWarehouse(entrepot: any): void {
        if (!entrepot.id) return;

        if (confirm(`Êtes-vous sûr de vouloir supprimer l'entrepôt "${entrepot.nom}" ?`)) {
            this.loading = true;
            this.warehousesService.delete(entrepot.id).subscribe({
                next: () => {
                    this.snackBar.open('Entrepôt supprimé avec succès', 'Fermer', { duration: 3000 });
                    if (this.centre?.id) {
                        this.loadCentre(this.centre.id);
                    }
                },
                error: (err) => {
                    console.error('Error deleting warehouse:', err);
                    this.snackBar.open('Erreur lors de la suppression de l\'entrepôt', 'Fermer', { duration: 3000 });
                    this.loading = false;
                    this.cdr.detectChanges();
                }
            });
        }
    }
}
