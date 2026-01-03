import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { FinanceService } from '../../services/finance.service';
import { SupplierInvoice } from '../../models/finance.models';
import { InvoiceFormDialogComponent } from '../../components/invoice-form-dialog/invoice-form-dialog.component';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';

@Component({
  selector: 'app-supplier-invoice-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatMenuModule,
    MatDividerModule,
    MatDialogModule,
    RouterModule
  ],
  templateUrl: './supplier-invoice-list.component.html',
  styles: [`
    .container { padding: 24px; max-width: 100%; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    table { width: 100%; }
    .mat-column-date { width: 100px; }
    .mat-column-numero { width: 150px; }
    .mat-column-statut { width: 100px; }
    .mat-column-actions { width: 80px; text-align: right; }
    .montant-cell { font-weight: bold; text-align: right; color: #2c3e50; }
    .statut-chip { font-size: 11px; height: 26px; font-weight: 500; letter-spacing: 0.3px; }
    
    tr.mat-mdc-header-row { background-color: #f8fafc; }
    th.mat-mdc-header-cell { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
    td.mat-mdc-cell { color: #334155; font-size: 13px; padding: 12px 8px !important; }
    
    .mat-mdc-card { border-radius: 12px; overflow: hidden; }
    .font-medium { color: #1e293b; font-weight: 500; }
  `]
})
export class SupplierInvoiceListComponent implements OnInit {
  invoices: SupplierInvoice[] = [];
  displayedColumns: string[] = ['date', 'numero', 'fournisseur', 'client', 'ficheMedicale', 'type', 'statut', 'montant', 'actions'];
  loading = false;
  currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

  constructor(
    private financeService: FinanceService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private store: Store
  ) {
    effect(() => {
      const center = this.currentCentre();
      if (center?.id) {
        this.loadInvoices();
      }
    });
  }

  ngOnInit(): void {
    // Handled by effect
  }

  loadInvoices() {
    this.loading = true;
    this.financeService.getInvoices().subscribe({
      next: (data) => {
        this.invoices = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement factures', err);
        this.snackBar.open('Erreur lors du chargement des factures', 'Fermer', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  openInvoiceDialog(invoice?: SupplierInvoice, viewMode: boolean = false) {
    const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      maxHeight: '90vh', // Auto height with max limit
      data: { invoice, viewMode }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadInvoices();
      }
    });
  }

  deleteInvoice(invoice: SupplierInvoice) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la facture ${invoice.numeroFacture} ?`)) {
      this.financeService.deleteInvoice(invoice.id!).subscribe({
        next: () => {
          this.snackBar.open('Facture supprimée', 'Fermer', { duration: 3000 });
          this.loadInvoices();
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  createInvoice(data: any) {
    this.financeService.createInvoice(data).subscribe({
      next: () => {
        this.snackBar.open('Facture enregistrée avec succès', 'OK', { duration: 3000 });
        this.loadInvoices();
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Erreur lors de l’enregistrement', 'Fermer', { duration: 3000 });
      }
    });
  }

  getStatusClass(statut: string): string {
    switch (statut) {
      case 'PAYEE': return 'bg-green-100 text-green-800';
      case 'PARTIELLE': return 'bg-orange-100 text-orange-800';
      case 'EN_ATTENTE': return 'bg-blue-100 text-blue-800';
      case 'RETARD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  formatClientName(client: any): string {
    if (!client) return '-';
    if (client.raisonSociale) return client.raisonSociale;
    return `${client.nom || ''} ${client.prenom || ''}`.trim() || '-';
  }
}
