import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FicheService } from '../../../client-management/services/fiche.service';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { BcPrintService } from '../../../client-management/services/bc-print.service';
import { take, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { UserSelector } from '../../../../core/store/auth/auth.selectors';
import { signal } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-bc-history-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule
  ],
  templateUrl: './bc-history-list.component.html',
  styleUrls: ['./bc-history-list.component.scss'],
  providers: [BcPrintService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BcHistoryListComponent implements OnInit {
  displayedColumns: string[] = ['date', 'numero', 'fournisseur', 'client', 'motive', 'actions'];
  history: any[] = [];
  dataSource = new MatTableDataSource<any>([]);
  loading = false;
  companySettings: any = null;

  // Filters
  filterSupplier = '';
  filterClient = '';
  filterMotive = '';

  selectedPeriod = signal<string>('this-month');
  periods = [
    { value: 'all', label: 'Toutes les périodes' },
    { value: 'today', label: "Aujourd'hui" },
    { value: 'this-month', label: 'Ce mois-ci' },
    { value: 'last-month', label: 'Mois dernier' },
    { value: 'this-year', label: 'Cette année' },
    { value: 'custom', label: 'Personnalisée' }
  ];
  customStartDate: Date | null = null;
  customEndDate: Date | null = null;

  subtotals = {
    count: 0
  };

  uniqueSuppliers: string[] = [];
  uniqueClients: string[] = [];
  uniqueMotives: string[] = [];

  constructor(
    private ficheService: FicheService,
    private companySettingsService: CompanySettingsService,
    private bcPrintService: BcPrintService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private store: Store
  ) {}

  ngOnInit(): void {
    // Setup custom filter logic
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const searchTerms = JSON.parse(filter);
      const matchSupplier = !searchTerms.supplier || this.getSupplierName(data.fournisseur) === searchTerms.supplier;
      const matchClient = !searchTerms.client || data.clientDisplayName === searchTerms.client;
      const matchMotive = !searchTerms.motive || this.cleanMotif(data.motive || '') === searchTerms.motive;
      
      let matchDate = true;
      if (searchTerms.period !== 'all') {
        const d = new Date(data.date);
        const now = new Date();
        
        let startD: Date;
        let endD: Date;

        if (searchTerms.period === 'today') {
           startD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
           endD = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        } else if (searchTerms.period === 'this-month') {
           startD = new Date(now.getFullYear(), now.getMonth(), 1);
           endD = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else if (searchTerms.period === 'last-month') {
           startD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
           endD = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        } else if (searchTerms.period === 'this-year') {
           startD = new Date(now.getFullYear(), 0, 1);
           endD = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        } else if (searchTerms.period === 'custom') {
           startD = searchTerms.startDate ? new Date(searchTerms.startDate) : new Date(0);
           endD = searchTerms.endDate ? new Date(searchTerms.endDate) : new Date("2100-01-01");
           endD.setHours(23, 59, 59);
        } else {
           startD = new Date(0);
           endD = new Date("2100-01-01");
        }
        
        matchDate = d >= startD && d <= endD;
      }

      return matchSupplier && matchClient && matchMotive && matchDate;
    };

    this.loadHistory();
    this.loadCompanySettings();
  }

  loadHistory(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const period = this.selectedPeriod();
    let startDate: string | undefined;
    let endDate: string | undefined;
    const now = new Date();

    if (period === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      startDate = todayStart.toISOString();
      endDate = todayEnd.toISOString();
    } else if (period === 'this-month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      startDate = firstDay.toISOString();
      endDate = lastDay.toISOString();
    } else if (period === 'last-month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      startDate = firstDayLastMonth.toISOString();
      endDate = lastDayLastMonth.toISOString();
    } else if (period === 'this-year') {
      const firstDayYear = new Date(now.getFullYear(), 0, 1);
      const lastDayYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      startDate = firstDayYear.toISOString();
      endDate = lastDayYear.toISOString();
    } else if (period === 'custom') {
      if (this.customStartDate) startDate = this.customStartDate.toISOString();
      if (this.customEndDate) {
        const end = new Date(this.customEndDate);
        end.setHours(23, 59, 59);
        endDate = end.toISOString();
      }
    }

    this.ficheService.getAllBcHistory({ startDate, endDate }).subscribe({
      next: (data) => {
        this.history = data;
        this.dataSource.data = data;
        this.extractFilterOptions(data);
        this.applyFilters(); // trigger filter and stats
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Erreur lors du chargement de l\'historique BC:', err);
        this.loading = false;
        this.snackBar.open('Erreur lors du chargement de l\'historique', 'Fermer', { duration: 3000 });
        this.cdr.markForCheck();
      }
    });
  }

  private extractFilterOptions(data: any[]): void {
    const suppliers = new Set<string>();
    const clients = new Set<string>();
    const motives = new Set<string>();

    data.forEach(item => {
      if (item.fournisseur) suppliers.add(this.getSupplierName(item.fournisseur));
      if (item.clientDisplayName) clients.add(item.clientDisplayName);
      const cleanedMotif = this.cleanMotif(item.motive || '');
      if (cleanedMotif) motives.add(cleanedMotif);
    });

    this.uniqueSuppliers = Array.from(suppliers).sort();
    this.uniqueClients = Array.from(clients).sort();
    this.uniqueMotives = Array.from(motives).sort();
  }

  onPeriodChange(event: any): void {
    this.selectedPeriod.set(event.value);
    this.loadHistory();
  }

  applyFilters(): void {
    this.dataSource.filter = JSON.stringify({
      supplier: this.filterSupplier,
      client: this.filterClient,
      motive: this.filterMotive,
      period: this.selectedPeriod(),
      startDate: this.customStartDate,
      endDate: this.customEndDate
    });
    this.updateStats();
  }

  updateStats(): void {
    this.subtotals = {
      count: this.dataSource.filteredData.length
    };
    this.cdr.markForCheck();
  }

  clearFilters(): void {
    this.filterSupplier = '';
    this.filterClient = '';
    this.filterMotive = '';
    this.selectedPeriod.set('this-month');
    this.customStartDate = null;
    this.customEndDate = null;
    this.loadHistory(); // Reload with default period
  }

  cleanReference(numero: string): string {
    if (!numero) return '-';
    // Remove "Fac: ", "FAC ", "BC: ", "BC " prefixes
    let clean = numero.replace(/^(Fac|BC):\s*/i, '').replace(/^(FAC|BC)\s+/i, '').trim();
    
    // De-duplicate pattern like "Fact-2/2026Fact-2/2026"
    const half = clean.length / 2;
    if (clean.length % 2 === 0 && clean.substring(0, half) === clean.substring(half)) {
      clean = clean.substring(0, half);
    }
    return clean;
  }

  cleanMotif(motif: string): string {
    if (!motif) return 'Standard';
    let cleaned = motif.trim();
    
    if (cleaned.includes('Paiement:')) {
        if (cleaned.includes('Fact-') || cleaned.toLowerCase().includes('facture')) return 'Paiement Facture';
        if (cleaned.includes('BC-') || cleaned.toLowerCase().includes('bon de commande')) return 'Paiement BC';
        if (cleaned.includes('BL-') || cleaned.toLowerCase().includes('bon de livraison')) return 'Paiement BL';
        return 'Paiement Divers';
    }
    return cleaned;
  }

  loadCompanySettings(): void {
    this.companySettingsService.getSettings().pipe(take(1)).subscribe(settings => {
      this.companySettings = settings;
    });
  }

  getSupplierName(fournisseur: any): string {
    if (!fournisseur) return '-';
    if (typeof fournisseur === 'string') return fournisseur;
    if (fournisseur.name) return fournisseur.name;
    if (fournisseur.nom) return fournisseur.nom;
    return '-';
  }

  async reprintBC(bcRecord: any): Promise<void> {
    if (!bcRecord.ficheId) {
      this.snackBar.open('Erreur: ID de fiche manquant pour cette réimpression', 'Fermer', { duration: 3000 });
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    try {
      // 1. Fetch the full fiche data to have complete details
      const fiche = await firstValueFrom(this.ficheService.getFicheById(bcRecord.ficheId));
      if (!fiche) {
        throw new Error('Fiche introuvable');
      }

      // 2. Get current user for the print footer
      const currentUser = await firstValueFrom(this.store.select(UserSelector).pipe(take(1)));

      // 3. Use the unified BcPrintService
      const reference = this.cleanReference(bcRecord.numero || 'N/A');
      const fournisseurName = this.getSupplierName(bcRecord.fournisseur);

      this.bcPrintService.printBonCommande(
        fiche,
        this.companySettings,
        currentUser,
        reference,
        fournisseurName
      );

    } catch (error) {
      console.error('Erreur lors de la réimpression BC:', error);
      this.snackBar.open('Erreur lors de la réimpression du Bon de Commande', 'Fermer', { duration: 4000 });
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
