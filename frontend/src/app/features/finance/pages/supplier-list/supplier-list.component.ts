import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { FinanceService } from '../../services/finance.service';
import { Supplier } from '../../models/finance.models';
import { SupplierFormDialogComponent } from '../../components/supplier-form-dialog/supplier-form-dialog.component';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    MatDialogModule,
    RouterModule
  ],
  templateUrl: './supplier-list.component.html',
  styles: [`
    .container { padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    table { width: 100%; }
    .actions { display: flex; gap: 8px; }
  `]
})
export class SupplierListComponent implements OnInit {
  suppliers: Supplier[] = [];
  displayedColumns: string[] = ['nom', 'contact', 'telephone', 'ville', 'actions'];
  loading = false;

  constructor(
    private financeService: FinanceService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers() {
    this.loading = true;
    this.financeService.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement fournisseurs', err);
        this.snackBar.open('Erreur lors du chargement des fournisseurs', 'Fermer', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  openSupplierDialog(supplier?: Supplier, viewMode: boolean = false) {
    const dialogRef = this.dialog.open(SupplierFormDialogComponent, {
      width: '1000px',
      maxWidth: '95vw',
      height: '90vh',
      data: { supplier, viewMode }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSuppliers();
      }
    });
  }

  createSupplier(data: any) {
    this.financeService.createSupplier(data).subscribe({
      next: () => {
        this.snackBar.open('Fournisseur créé avec succès', 'OK', { duration: 3000 });
        this.loadSuppliers();
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Erreur lors de la création', 'Fermer', { duration: 3000 });
      }
    });
  }

  updateSupplier(id: string, data: any) {
    this.financeService.updateSupplier(id, data).subscribe({
      next: () => {
        this.snackBar.open('Fournisseur mis à jour', 'OK', { duration: 3000 });
        this.loadSuppliers();
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Erreur lors de la mise à jour', 'Fermer', { duration: 3000 });
      }
    });
  }

  deleteSupplier(supplier: Supplier) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${supplier.nom} ?`)) {
      this.financeService.deleteSupplier(supplier.id).subscribe({
        next: () => {
          this.snackBar.open('Fournisseur supprimé', 'OK', { duration: 3000 });
          this.loadSuppliers();
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
        }
      });
    }
  }
}
