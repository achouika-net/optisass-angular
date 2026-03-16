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
import { take } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

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
    FormsModule
  ],
  templateUrl: './bc-history-list.component.html',
  styleUrls: ['./bc-history-list.component.scss'],
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

  uniqueSuppliers: string[] = [];
  uniqueClients: string[] = [];
  uniqueMotives: string[] = [];

  constructor(
    private ficheService: FicheService,
    private companySettingsService: CompanySettingsService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Setup custom filter logic
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const searchTerms = JSON.parse(filter);
      const matchSupplier = !searchTerms.supplier || this.getSupplierName(data.fournisseur) === searchTerms.supplier;
      const matchClient = !searchTerms.client || data.clientDisplayName === searchTerms.client;
      const matchMotive = !searchTerms.motive || this.cleanMotif(data.motive || '') === searchTerms.motive;
      return matchSupplier && matchClient && matchMotive;
    };

    this.loadHistory();
    this.loadCompanySettings();
  }

  loadHistory(): void {
    this.loading = true;
    this.ficheService.getAllBcHistory().subscribe({
      next: (data) => {
        this.history = data;
        this.dataSource.data = data;
        this.extractFilterOptions(data);
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

  applyFilters(): void {
    this.dataSource.filter = JSON.stringify({
      supplier: this.filterSupplier,
      client: this.filterClient,
      motive: this.filterMotive
    });
  }

  clearFilters(): void {
    this.filterSupplier = '';
    this.filterClient = '';
    this.filterMotive = '';
    this.applyFilters();
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

  reprintBC(bcRecord: any): void {
    const fournisseurName = this.getSupplierName(bcRecord.fournisseur);
    const ord = bcRecord.ordonnance || {};
    const lentilles = bcRecord.lentilles || {};
    const today = new Date(bcRecord.date).toLocaleDateString('fr-FR');
    const ref = this.cleanReference(bcRecord.numero || 'N/A');
    const motive = this.cleanMotif(bcRecord.motive || 'Standard');

    // Dynamic Logo and Company Name
    const logoUrl = this.companySettings?.logoUrl || `${window.location.origin}/assets/images/logo.png`;
    const companyName = this.companySettings?.name || 'OPTISASS';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.snackBar.open('Activez les popups pour imprimer', 'OK', { duration: 5000, verticalPosition: 'top' });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <title>Réimpression Bon de Commande - ${ref}</title>
          <style>
              @page { size: A4 portrait; margin: 0 !important; }
              body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 15mm; line-height: 1.5; font-size: 10pt; background: #fff; }
              .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
              .logo-box { display: flex; align-items: center; gap: 15px; }
              .logo-img { height: 75px; width: auto; object-fit: contain; }
              .company-info { text-align: right; }
              .company-info h1 { margin: 0; font-size: 22pt; font-weight: 950; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
              .doc-title { margin-top: 5px; font-size: 16pt; color: #3b82f6; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
              .meta-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 35px; }
              .info-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; }
              .info-card label { display: block; font-size: 8.5pt; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
              .info-card p { margin: 0; font-size: 13pt; font-weight: 800; color: #1e293b; }
              .motive-badge { padding: 4px 10px; background: #fee2e2; color: #ef4444; border-radius: 50px; font-size: 9pt; font-weight: 800; }
              .section-label { color: #94a3b8; font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { text-align: left; font-size: 8.5pt; text-transform: uppercase; color: #94a3b8; padding: 12px 10px; font-weight: 800; border-bottom: 2px solid #e2e8f0; }
              td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11pt; font-weight: 500; }
              .eye-row { font-weight: 900; color: #3b82f6; width: 60px; }
              .cachet-section { text-align: center; margin-top: 60px; }
              .cachet-box { display: inline-block; width: 240px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 16px; margin-top: 10px; }
              @media print { body { padding: 10mm 15mm; } }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo-box"><img src="${logoUrl}" class="logo-img"></div>
              <div class="company-info">
                  <h1>${companyName}</h1>
                  <div class="doc-title">Bon de Commande</div>
                  <div style="font-size: 8pt; color: #ef4444; font-weight: 800; margin-top: 5px;">(RÉIMPRESSION)</div>
              </div>
          </div>
          <div class="meta-info">
              <div class="info-card"><label>Fournisseur</label><p>${fournisseurName}</p></div>
              <div class="info-card">
                  <label>Référence BC / Date / Motif</label>
                  <p>${ref} — ${today} ${motive !== 'Standard' ? '<span class="motive-badge">' + motive + '</span>' : ''}</p>
              </div>
          </div>
          <div class="section-label">Détails de la Commande</div>
          <table>
              <thead><tr><th>Oeil</th><th>Produit (Marque / Modèle)</th><th>Sphère</th><th>Cyl / Axe</th><th>Rayon / Dia</th></tr></thead>
              <tbody>
                  <tr>
                      <td class="eye-row">OD</td>
                      <td>${lentilles.od?.marque || ''} ${lentilles.od?.modele || ''}</td>
                      <td>${ord.od?.sphere || '0.00'}</td>
                      <td>${ord.od?.cylindre || '0.00'} / ${ord.od?.axe || '0'}°</td>
                      <td>${lentilles.od?.rayon || '-'} / ${lentilles.od?.diametre || '-'}</td>
                  </tr>
                  <tr>
                      <td class="eye-row">OG</td>
                      <td>${(lentilles.diffLentilles ? lentilles.og?.marque : lentilles.od?.marque) || ''} ${(lentilles.diffLentilles ? lentilles.og?.modele : lentilles.od?.modele) || ''}</td>
                      <td>${ord.og?.sphere || '0.00'}</td>
                      <td>${ord.og?.cylindre || '0.00'} / ${ord.og?.axe || '0'}°</td>
                      <td>${(lentilles.diffLentilles ? lentilles.og?.rayon : lentilles.od?.rayon) || '-'} / ${(lentilles.diffLentilles ? lentilles.og?.diametre : lentilles.od?.diametre) || '-'}</td>
                  </tr>
              </tbody>
          </table>
          <div class="cachet-section">
              <p style="font-weight: 800; color: #475569;">Cachet du Magasin</p>
              <div class="cachet-box"></div>
          </div>
          <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }
}
