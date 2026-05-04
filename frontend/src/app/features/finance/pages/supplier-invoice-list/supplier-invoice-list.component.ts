import { Component, OnInit, effect, signal, Input, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
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
    
    tr.mat-mdc-header-row { background-color: #0c4891 !important; }
    th.mat-mdc-header-cell { color: white !important; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
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
    .print-layout { display: none; }

    @media print {
      body.is-printing-report .container,
      body.is-printing-report mat-sidenav-container,
      body.is-printing-report app-header,
      body.is-printing-report app-sidebar {
        display: none !important;
      }

      .print-isolated {
        display: block !important;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        background: white;
        padding: 10mm;
      }
      
      .print-header { margin-bottom: 30px; border-bottom: 2px solid #0c4891; padding-bottom: 15px; }
      .print-header h2 { margin: 0; color: #0c4891; }
      
      .print-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      .print-table th, .print-table td { border: 1px solid #e2e8f0; padding: 10px 8px; font-size: 11px; text-align: left; }
      .print-table th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; color: #334155; font-weight: 600; text-transform: uppercase; }
      
      .sub-text { font-size: 9px; color: #64748b; display: block; margin-top: 2px; }
      .text-right { text-align: right !important; }
      .font-bold { font-weight: 700; }
      .uppercase { text-transform: uppercase; }
      .tracking-wider { letter-spacing: 0.05em; }
      
      .total-row { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
      .paid-row { color: #15803d !important; -webkit-print-color-adjust: exact; }
      .remaining-row { color: #c2410c !important; -webkit-print-color-adjust: exact; }
      
      footer-recap-cell { padding-top: 15px !important; }
    }

  `]
})
export class SupplierInvoiceListComponent implements OnInit {
  @Input() public listMode: 'INVOICE' | 'BL' = 'BL';
  @Input() public showHeader = true;
  @Input() public isSubComponent = false;
  @Output() public statsUpdated = new EventEmitter<any>();

  public invoices: SupplierInvoice[] = [];
  public displayedColumns: string[] = [];
  public loading = false;
  public currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
  public selection = new SelectionModel<SupplierInvoice>(true, []);

  public totalCount = 0;
  public pageIndex = 0;
  public pageSize = 10;
  public selectAllResults = false;

  public selectedPeriod = signal<string>('this-month');
  public periods = [
    { value: 'all', label: 'Toutes les périodes' },
    { value: 'today', label: "Aujourd'hui" },
    { value: 'this-month', label: 'Ce mois-ci' },
    { value: 'last-month', label: 'Mois dernier' },
    { value: 'this-year', label: 'Cette année' },
    { value: 'custom', label: 'Plage personnalisée' }
  ];

  public suppliers: any[] = [];
  public filters = {
    fournisseurId: '',
    statut: '',
    facturation: 'EN_ATTENTE',
    startDate: null as Date | null,
    endDate: null as Date | null
  };

  public stats = {
    totalTTC: 0,
    totalPaid: 0,
    totalRemaining: 0
  };
  public printDate = new Date();

  constructor(
    private financeService: FinanceService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private store: Store,
    private cdr: ChangeDetectorRef
  ) {
    effect(() => {
      const center = this.currentCentre();
      const period = this.selectedPeriod();
      if (center?.id) {
        this.loadInvoices();
      }
    });
  }

  public ngOnInit(): void {
    this.loadSuppliers();
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'BL') {
        this.listMode = 'BL';
      } else if (params['tab'] === 'FACTURES') {
        this.listMode = 'INVOICE';
      }
      this.updateColumns();
      this.selectAllResults = false;
      this.loadInvoices();
    });
  }

  public updateColumns() {
    if (this.listMode === 'BL') {
      this.displayedColumns = ['select', 'date', 'numero', 'fournisseur', 'client', 'ficheMedicale', 'type', 'paiement', 'facture', 'statut', 'montant', 'actions'];
    } else {
      this.displayedColumns = ['date', 'numero', 'fournisseur', 'type', 'paiement', 'pieces', 'echeance_dates', 'statut', 'montant', 'actions'];
    }
  }

  public getPaymentType(element: SupplierInvoice): string {
    if (!element.echeances || element.echeances.length === 0) return '-';
    const types = Array.from(new Set(element.echeances.map(e => e.type)));
    if (types.length === 1) return types[0];
    return 'MIXTE';
  }

  public getPieceCount(element: any): number {
    if (element.childBLs && element.childBLs.length > 0) {
      return element.childBLs.length;
    }
    return element.echeances?.length || 0;
  }

  public getPieceDates(element: SupplierInvoice): string {
    if (!element.echeances || element.echeances.length === 0) return '-';
    const sorted = [...element.echeances].sort((a, b) => 
      new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime()
    );
    if (sorted.length > 3) {
      const first = new Date(sorted[0].dateEcheance);
      const last = new Date(sorted[sorted.length - 1].dateEcheance);
      return `${this.formatDateShort(first)}...${this.formatDateShort(last)} (${sorted.length})`;
    }
    return sorted.map(e => this.formatDateShort(new Date(e.dateEcheance))).join(', ');
  }

  private formatDateShort(date: Date): string {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  public applyFilters() {
    this.loadInvoices();
  }

  public resetFilters() {
    this.selectedPeriod.set('all');
    this.filters = {
      fournisseurId: '',
      statut: '',
      facturation: 'EN_ATTENTE',
      startDate: null,
      endDate: null
    };
    this.loadInvoices();
  }

  public loadSuppliers() {
    this.financeService.getSuppliers().subscribe(data => this.suppliers = data);
  }

  public loadInvoices() {
    const center = this.currentCentre();
    if (!center?.id) return;
    this.loading = true;
    this.cdr.markForCheck();
    let startDate: string | undefined;
    let endDate: string | undefined;
    const now = new Date();
    if (this.selectedPeriod() === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
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
    const serviceCall = this.listMode === 'BL'
      ? this.financeService.getBonLivraisons({
          centreId: center.id,
          fournisseurId: this.filters.fournisseurId || undefined,
          statut: this.filters.statut || undefined,
          facturation: this.filters.facturation || undefined,
          startDate,
          endDate,
          page: this.pageIndex + 1,
          limit: this.pageSize
        })
      : this.financeService.getInvoices({
          centreId: center.id,
          fournisseurId: this.filters.fournisseurId || undefined,
          statut: this.filters.statut || undefined,
          startDate,
          endDate,
          page: this.pageIndex + 1,
          limit: this.pageSize
        });
    (serviceCall as any).subscribe({
      next: (res: any) => {
        if (res && res.data !== undefined) {
          this.invoices = res.data || [];
          this.totalCount = Number(res.total);
          let calcTTC = 0; let calcHT = 0; let calcReste = 0;
          this.invoices.forEach(inv => {
            calcTTC += (inv.montantTTC || 0);
            calcHT += (inv.montantHT || 0);
            calcReste += ((inv as any).resteAPayer || 0);
          });
          if (res.stats) {
            this.stats = res.stats;
            this.statsUpdated.emit({
              count: this.totalCount,
              totalTTC: this.stats.totalTTC || calcTTC,
              totalHT: res.subtotals?.totalHT || calcHT, 
              totalReste: this.stats.totalRemaining || calcReste
            });
          } else {
            this.stats = { totalTTC: calcTTC, totalPaid: (calcTTC - calcReste), totalRemaining: calcReste };
            this.statsUpdated.emit({ count: this.totalCount, totalTTC: calcTTC, totalHT: calcHT, totalReste: calcReste });
          }
        } else {
          this.invoices = Array.isArray(res) ? res : [];
          this.totalCount = this.invoices.length;
        }
        this.loading = false;
        this.printDate = new Date();
        this.selection.clear();
        this.selectAllResults = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.snackBar.open('Erreur lors du chargement des données', 'Fermer', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  public onPageChange(event: any) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.selectAllResults = false;
    this.loadInvoices();
  }

  public isAllSelected() {
    return this.selection.selected.length === this.invoices.length;
  }

  public masterToggle() {
    if (this.isAllSelected()) {
      this.selection.clear();
      this.selectAllResults = false;
    } else {
      this.invoices.forEach(row => this.selection.select(row));
    }
  }

  public toggleSelectAllResults(val: boolean) {
    this.selectAllResults = val;
    if (!val) this.selection.clear();
  }

  public async groupSelectedBLs() {
    if (this.selection.selected.length < 2 && !this.selectAllResults) {
      this.snackBar.open('Veuillez sélectionner au moins 2 BL pour les grouper', 'Fermer', { duration: 3000 });
      return;
    }
    this.loading = true;
    let selectedBLs = this.selection.selected;
    if (this.selectAllResults) {
      try {
        const res = await (this.financeService.getBonLivraisons({
          centreId: this.currentCentre()?.id,
          fournisseurId: this.filters.fournisseurId || undefined,
          statut: this.filters.statut || undefined,
          startDate: this.filters.startDate?.toISOString(),
          endDate: this.filters.endDate?.toISOString(),
          page: 1,
          limit: 2000
        }).toPromise() as any);
        selectedBLs = res.data || [];
      } catch (error) {
        this.snackBar.open('Erreur lors de la récupération de tous les BL', 'Fermer', { duration: 3000 });
        this.loading = false;
        return;
      }
    }
    this.loading = false;
    if (selectedBLs.length < 2) {
      this.snackBar.open('Veuillez sélectionner au moins 2 BL pour les grouper', 'Fermer', { duration: 3000 });
      return;
    }
    const totalTTC = Math.round(selectedBLs.reduce((sum, bl) => sum + bl.montantTTC, 0) * 100) / 100;
    const totalHT = Math.round(selectedBLs.reduce((sum, bl) => sum + bl.montantHT, 0) * 100) / 100;
    const totalTVA = Math.round(selectedBLs.reduce((sum, bl) => sum + bl.montantTVA, 0) * 100) / 100;
    let lastPaidBLDate: Date | null = null;
    const totalPaye = Math.round(selectedBLs.reduce((sum, bl) => {
      let paidOnThisBL = 0;
      if (bl.statut === 'PAYEE') paidOnThisBL = bl.montantTTC;
      else if (bl.statut === 'PARTIELLE' && bl.echeances) {
        paidOnThisBL = bl.echeances.filter(e => e.statut === 'ENCAISSE').reduce((s, e) => s + e.montant, 0);
      }
      if (paidOnThisBL > 0) {
        const blDate = new Date(bl.dateEmission);
        if (!lastPaidBLDate || blDate > lastPaidBLDate) lastPaidBLDate = blDate;
      }
      return sum + paidOnThisBL;
    }, 0) * 100) / 100;
    const supplierId = selectedBLs[0].fournisseurId;
    const existingEcheances: any[] = [];
    selectedBLs.forEach(bl => { if (bl.echeances) existingEcheances.push(...bl.echeances); });
    if (selectedBLs.some(bl => bl.fournisseurId !== supplierId)) {
      this.snackBar.open('Tous les BL doivent appartenir au même fournisseur', 'Fermer', { duration: 3000 });
      return;
    }
    const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
      width: '1100px', maxWidth: '95vw', maxHeight: '90vh',
      data: {
        isGrouping: true,
        prefilledData: {
          fournisseurId: supplierId, 
          montantTTC: totalTTC, 
          montantHT: totalHT, 
          montantTVA: totalTVA,
          totalPaye, lastPaidBLDate, echeances: existingEcheances,
          type: 'ACHAT_GROUPE', numeroFacture: ''
        },
        blIds: selectedBLs.map(bl => bl.id)
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadInvoices();
        this.snackBar.open('Facture groupée enregistrée avec succès', 'Fermer', { duration: 3000 });
      }
    });
  }

  public openInvoiceDialog(invoice?: SupplierInvoice, viewMode: boolean = false) {
    const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
      width: '1100px', maxWidth: '95vw', maxHeight: '90vh',
      data: { invoice, viewMode, isBL: (invoice as any)?.numeroBL !== undefined || this.listMode === 'BL' }
    });
    dialogRef.afterClosed().subscribe(result => { if (result) this.loadInvoices(); });
  }

  public openExpenseDialog() {
    const dialogRef = this.dialog.open(ExpenseFormDialogComponent, { width: '800px', maxWidth: '95vw', data: {} });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.router.navigate(['/p/gestion-depenses/expenses']);
        this.snackBar.open('Dépense enregistrée.', 'Fermer', { duration: 5000 });
      }
    });
  }

  public openPaymentDialog(invoice: SupplierInvoice) {
    if (invoice.statut === 'PAYEE') {
      this.snackBar.open('Déjà payée', 'Fermer', { duration: 3000 });
      return;
    }
    const pendingEcheance = invoice.echeances?.find(e => e.statut === 'EN_ATTENTE');
    const isBL = (invoice as any).numeroBL !== undefined || this.listMode === 'BL';
    const numero = (invoice as any).numeroBL || invoice.numeroFacture;
    const dialogRef = this.dialog.open(ExpenseFormDialogComponent, {
      width: '600px',
      data: {
        expense: {
          fournisseurId: invoice.fournisseurId,
          factureFournisseurId: isBL ? undefined : invoice.id,
          bonLivraisonId: isBL ? invoice.id : undefined,
          echeanceId: pendingEcheance?.id,
          montant: invoice.montantTTC,
          categorie: invoice.type || 'ACHAT_STOCK',
          description: `Paiement ${isBL ? 'BL' : 'Facture'} ${numero}`,
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
        this.snackBar.open('Paiement enregistré', 'Fermer', { duration: 3000 });
      }
    });
  }

  public deleteInvoice(invoice: SupplierInvoice) {
    const isBL = (invoice as any).numeroBL !== undefined || this.listMode === 'BL';
    const numero = (invoice as any).numeroBL || invoice.numeroFacture;
    if (confirm(`Supprimer ${isBL ? 'le BL' : 'la facture'} ${numero} ?`)) {
      (isBL ? this.financeService.deleteBonLivraison(invoice.id!) : this.financeService.deleteInvoice(invoice.id!))
      .subscribe({
        next: () => {
          this.snackBar.open('Supprimé', 'Fermer', { duration: 3000 });
          this.loadInvoices();
        },
        error: (err) => this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 })
      });
    }
  }

  public getStatusClass(statut: string): string {
    switch (statut) {
      case 'PAYEE': return 'bg-green-100 text-green-800';
      case 'PARTIELLE': return 'bg-orange-100 text-orange-800';
      case 'EN_ATTENTE': return 'bg-blue-100 text-blue-800';
      case 'RETARD': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  public formatType(type: string): string {
    if (!type) return '-';
    const cleaned = type.replace('ACHAT_', '').replace(/_/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  }

  public formatClientName(client: any): string {
    if (!client) return '-';
    if (typeof client === 'string') return client;
    return `${client.nom || ''} ${client.prenom || ''}`.trim() || '-';
  }

  public getSupplierName(id: string): string {
    const s = this.suppliers.find(sup => sup.id === id);
    return s ? s.nom : id;
  }

  public getPeriodLabel(value: string): string {
    const p = this.periods.find(per => per.value === value);
    return p ? p.label : value;
  }

  public getToday(): Date { return new Date(); }

  public printList() {
    this.printDate = new Date();
    this.cdr.detectChanges();
    const printContent = document.querySelector('.print-layout');
    if (!printContent) { window.print(); return; }
    const clone = printContent.cloneNode(true) as HTMLElement;
    clone.classList.add('print-isolated');
    document.body.classList.add('is-printing-report');
    document.body.appendChild(clone);
    setTimeout(() => {
      window.print();
      document.body.classList.remove('is-printing-report');
      if (document.body.contains(clone)) document.body.removeChild(clone);
    }, 100);
  }

  public generateSupplierStatement() {
    if (!this.filters.fournisseurId) {
      this.snackBar.open('Sélectionnez un fournisseur', 'OK', { duration: 3000 });
      return;
    }
    this.printDate = new Date();
    this.printList();
  }
}
