import { Component, OnInit, effect, signal, Input, ChangeDetectorRef } from '@angular/core';
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
import { SelectionModel } from '@angular/cdk/collections';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';

import { FinanceService } from '../../services/finance.service';
import { SupplierInvoice } from '../../models/finance.models';
import { InvoiceFormDialogComponent } from '../../components/invoice-form-dialog/invoice-form-dialog.component';
import { ExpenseFormDialogComponent } from '../../components/expense-form-dialog/expense-form-dialog.component';
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
    MatCheckboxModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatPaginatorModule,
    RouterModule
  ],
  templateUrl: './supplier-invoice-list.component.html',
  styles: [`
    :host { display: block; width: 100%; overflow-x: hidden; }
    .container { padding: 24px; width: 95%; max-width: 1600px; margin: 0 auto; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    table { width: 100%; }
    .mat-column-select { width: 40px; }
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
    .group-toolbar { 
      background: #eff6ff; 
      padding: 12px 20px; 
      border-radius: 8px; 
      display: flex; 
      align-items: center; 
      justify-content: space-between;
    }
    .print-only-header { display: none; }

    .container-sub { padding: 0 !important; width: 100% !important; max-width: none !important; }
    .filters { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; flex-wrap: wrap; }
    .filters mat-form-field { flex: 1; min-width: 200px; }
    ::ng-deep .dense-field .mat-mdc-form-field-subscript-wrapper { display: none; }

    /* Print Styles - OVERLAY STRATEGY */
    .print-layout {
      display: none;
    }

  `]
})
export class SupplierInvoiceListComponent implements OnInit {
  @Input() listMode: 'INVOICE' | 'BL' = 'BL';
  @Input() showHeader = true;
  @Input() isSubComponent = false;

  invoices: SupplierInvoice[] = [];
  displayedColumns: string[] = ['select', 'date', 'numero', 'fournisseur', 'client', 'ficheMedicale', 'type', 'statut', 'montant', 'actions'];
  loading = false;
  currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
  selection = new SelectionModel<SupplierInvoice>(true, []);

  totalCount = 0;
  pageIndex = 0;
  pageSize = 50;

  selectedPeriod = signal<string>('all');
  periods = [
    { value: 'all', label: 'Toutes les périodes' },
    { value: 'today', label: "Aujourd'hui" },
    { value: 'this-month', label: 'Ce mois-ci' },
    { value: 'last-month', label: 'Mois dernier' },
    { value: 'this-year', label: 'Cette année' },
    { value: 'custom', label: 'Plage personnalisée' }
  ];

  suppliers: any[] = [];
  filters = {
    fournisseurId: '',
    startDate: null as Date | null,
    endDate: null as Date | null
  };

  constructor(
    private financeService: FinanceService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private store: Store,
    private cdr: ChangeDetectorRef
  ) {
    effect(() => {
      const center = this.currentCentre();
      if (center?.id) {
        this.loadInvoices();
      }
    });

    effect(() => {
      // Reload when period changes
      this.selectedPeriod();
      this.loadInvoices();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.loadSuppliers();
  }

  applyFilters() {
    this.loadInvoices();
  }

  resetFilters() {
    this.selectedPeriod.set('all');
    this.filters = {
      fournisseurId: '',
      startDate: null,
      endDate: null
    };
    this.loadInvoices();
  }

  loadSuppliers() {
    this.financeService.getSuppliers().subscribe(data => this.suppliers = data);
  }

  loadInvoices() {
    this.loading = true;
    const center = this.currentCentre();

    let startDate: string | undefined;
    let endDate: string | undefined;

    const now = new Date();
    if (this.selectedPeriod() === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      startDate = todayStart.toISOString();
      endDate = todayEnd.toISOString();
    } else if (this.selectedPeriod() === 'this-month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    } else if (this.selectedPeriod() === 'last-month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    } else if (this.selectedPeriod() === 'this-year') {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString();
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    } else if (this.selectedPeriod() === 'custom') {
      if (this.filters.startDate) startDate = new Date(this.filters.startDate).toISOString();
      if (this.filters.endDate) {
        const end = new Date(this.filters.endDate);
        end.setHours(23, 59, 59);
        endDate = end.toISOString();
      }
    }

    this.financeService.getInvoices({
      centreId: center?.id,
      fournisseurId: this.filters.fournisseurId || undefined,
      startDate,
      endDate,
      isBL: this.listMode === 'BL',
      page: this.pageIndex + 1,
      limit: this.pageSize
    }).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.invoices = res;
          this.totalCount = res.length;
        } else {
          this.invoices = res?.data || [];
          this.totalCount = res?.total || 0;
        }
        this.loading = false;
        this.selection.clear();
      },
      error: (err) => {
        console.error('Erreur chargement factures', err);
        this.snackBar.open('Erreur lors du chargement des factures', 'Fermer', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  onPageChange(event: any) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadInvoices();
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.invoices.length;
    return numSelected === numRows;
  }

  masterToggle() {
    this.isAllSelected() ?
      this.selection.clear() :
      this.invoices.forEach(row => this.selection.select(row));
  }

  groupSelectedBLs() {
    if (this.selection.selected.length < 2) {
      this.snackBar.open('Veuillez sélectionner au moins 2 BL pour les grouper', 'Fermer', { duration: 3000 });
      return;
    }

    // Totalize for the new invoice
    const totalTTC = Math.round(this.selection.selected.reduce((sum, bl) => sum + bl.montantTTC, 0) * 100) / 100;
    const totalHT = Math.round(this.selection.selected.reduce((sum, bl) => sum + bl.montantHT, 0) * 100) / 100;
    const totalTVA = Math.round(this.selection.selected.reduce((sum, bl) => sum + bl.montantTVA, 0) * 100) / 100;

    // Calculate already paid amount from child BLs
    const totalPaye = Math.round(this.selection.selected.reduce((sum, bl) => {
      if (bl.statut === 'PAYEE') return sum + bl.montantTTC;
      if (bl.statut === 'PARTIELLE' && bl.echeances) {
        return sum + bl.echeances.filter(e => e.statut === 'ENCAISSE').reduce((s, e) => s + e.montant, 0);
      }
      return sum;
    }, 0) * 100) / 100;

    const supplierId = this.selection.selected[0].fournisseurId;

    if (this.selection.selected.some(bl => bl.fournisseurId !== supplierId)) {
      this.snackBar.open('Tous les BL doivent appartenir au même fournisseur', 'Fermer', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
      width: '1400px',
      maxWidth: '98vw',
      maxHeight: '95vh',
      data: {
        isGrouping: true,
        prefilledData: {
          fournisseurId: supplierId,
          montantTTC: totalTTC,
          montantHT: totalHT,
          montantTVA: totalTVA,
          totalPaye: totalPaye, // Pass the already paid amount
          type: 'ACHAT_GROUPE',
          numeroFacture: `GROUPE-${new Date().getTime()}`
        },
        blIds: this.selection.selected.map(bl => bl.id)
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadInvoices();
        this.snackBar.open('Facture groupée enregistrée avec succès', 'Fermer', { duration: 3000 });
      }
    });
  }

  openInvoiceDialog(invoice?: SupplierInvoice, viewMode: boolean = false) {
    const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
      width: '1400px',
      maxWidth: '98vw',
      maxHeight: '98vh',
      data: { invoice, viewMode, isBL: invoice ? invoice.isBL : this.listMode === 'BL' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadInvoices();
      }
    });
  }

  openExpenseDialog() {
    const dialogRef = this.dialog.open(ExpenseFormDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.router.navigate(['/p/gestion-depenses/expenses']);
        this.snackBar.open('Dépense enregistrée. Vous avez été redirigé vers la liste des dépenses.', 'Fermer', { duration: 5000 });
      }
    });
  }

  openPaymentDialog(invoice: SupplierInvoice) {
    // If the invoice is already paid, notify the user
    if (invoice.statut === 'PAYEE') {
      this.snackBar.open('Cette facture est déjà payée', 'Fermer', { duration: 3000 });
      return;
    }

    // Find first pending echeance
    const pendingEcheance = invoice.echeances?.find(e => e.statut === 'EN_ATTENTE');

    const dialogRef = this.dialog.open(ExpenseFormDialogComponent, {
      width: '600px',
      data: {
        expense: {
          fournisseurId: invoice.fournisseurId,
          factureFournisseurId: invoice.id,
          echeanceId: pendingEcheance?.id,
          montant: invoice.montantTTC, // Default to full amount
          categorie: invoice.type || 'ACHAT_STOCK',
          description: `Paiement BL ${invoice.numeroFacture}`,
          date: new Date().toISOString(),
          modePaiement: 'ESPECES',
          statut: 'VALIDEE',
          centreId: invoice.centreId || this.currentCentre()?.id
        }
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadInvoices();
        this.snackBar.open('Paiement enregistré avec succès', 'Fermer', { duration: 3000 });
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
    // Handle both cases: string (legacy) or object
    if (typeof client === 'string') return client;
    return `${client.nom || ''} ${client.prenom || ''}`.trim() || '-';
  }

  getSupplierName(id: string): string {
    const s = this.suppliers.find(sup => sup.id === id);
    return s ? s.nom : id;
  }

  getPeriodLabel(value: string): string {
    const p = this.periods.find(per => per.value === value);
    return p ? p.label : value;
  }

  getTotalTTC(): number {
    return this.invoices.reduce((acc, inv) => acc + (inv.montantTTC || 0), 0);
  }

  printList() {
    this.cdr.detectChanges();

    // 1. Get the print layout element
    const printContent = document.querySelector('.print-layout');
    if (!printContent) {
      console.error('❌ [Print] Print layout element not found');
      window.print();
      return;
    }

    // 2. Clone it and prepare for isolation
    const clone = printContent.cloneNode(true) as HTMLElement;
    clone.classList.add('print-isolated');

    // 3. Mark body as printing and append clone
    document.body.classList.add('is-printing-report');
    document.body.appendChild(clone);

    // 4. Trigger print
    setTimeout(() => {
      window.print();

      // 5. Cleanup after the print dialog is closed
      document.body.classList.remove('is-printing-report');
      if (document.body.contains(clone)) {
        document.body.removeChild(clone);
      }
    }, 100);
  }
}
