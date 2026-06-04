import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-banque-releve',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
  ],
  templateUrl: './banque-releve.component.html',
  styleUrl: './banque-releve.component.scss',
})
export class BanqueReleveComponent implements OnInit {
  private api = `${environment.apiUrl}/api/banque`;

  comptes = signal<any[]>([]);
  transactions = signal<any[]>([]);
  paiementsAttente = signal<any[]>([]);
  depensesAttente = signal<any[]>([]);
  selectedCompteId = signal<string>('');
  allTransactions = signal<any[]>([]);
  availableMonths = signal<string[]>([]);
  selectedMonth = signal<string>('');

  // Filtres pour la section Rapprochement en Attente (independants du releve)
  rappFilterMonth = signal<string>('');
  rappFilterStatutPaiement = signal<string>('');   // '' = tous | 'EN_ATTENTE' | 'REMIS_EN_BANQUE'
  rappFilterStatutDepense = signal<string>('');    // '' = tous | 'EN_ATTENTE' | 'REMIS_EN_BANQUE'
  
  filteredTransactions = computed(() => {
    const month = this.selectedMonth();
    let txs = this.allTransactions();
    if (this.selectedCompteId()) {
      txs = txs.filter(t => t.releveBancaire?.compteBancaireId === this.selectedCompteId());
    }
    if (month) {
      txs = txs.filter(t => t.dateTransaction.startsWith(month));
    }
    return txs;
  });

  filteredPaiements = computed(() => {
    let items = this.paiementsAttente();
    const month = this.rappFilterMonth();
    const statut = this.rappFilterStatutPaiement();
    if (month) {
      items = items.filter((p: any) => {
        const d = p.dateVersement || p.date;
        if (!d) return false;
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return false;
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        return yyyy + '-' + mm === month;
      });
    }
    if (statut) {
      items = items.filter((p: any) => {
        if (statut === 'REMIS_EN_BANQUE') {
          return p.statut === 'REMIS_EN_BANQUE';
        }
        return p.statut === statut;
      });
    }
    return items;
  });

  filteredDepenses = computed(() => {
    let items = this.depensesAttente();
    const month = this.rappFilterMonth();
    const statut = this.rappFilterStatutDepense();
    if (month) {
      items = items.filter((d: any) => {
        const dateVal = d.date || d.dateEcheance;
        if (!dateVal) return false;
        const dateObj = new Date(dateVal);
        if (isNaN(dateObj.getTime())) return false;
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        return yyyy + '-' + mm === month;
      });
    }
    if (statut) {
      items = items.filter((d: any) => {
        if (statut === 'REMIS_EN_BANQUE') {
          return d.statut === 'REMIS_EN_BANQUE' || d.statut === 'A_PAYER';
        }
        return d.statut === statut;
      });
    }
    return items;
  });
  recapMois = computed<any[]>(() => {
    const txs = this.filteredTransactions();
    const recap: any = {};
    for (const t of txs) {
      const typeDesc = t.typeTransaction || 'AUTRE';
      const direction = t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT';
      const key = typeDesc + '_' + direction + '_' + t.statutRapprochement;
      if (!recap[key]) {
        recap[key] = { type: typeDesc, direction: direction, statut: t.statutRapprochement, count: 0, montant: 0, isCredit: t.type === 'CREDIT' };
      }
      recap[key].count++;
      recap[key].montant += t.montant;
    }
    const arr = Object.values(recap) as any[];
    arr.sort((a: any, b: any) => b.montant - a.montant);
    return arr;
  });

  loading = signal(false);

  transactionCols = ['date', 'description', 'type', 'montant', 'statut'];
  paiementCols = ['date', 'mode', 'montant', 'statut'];
  depenseCols = ['date', 'categorie', 'montant', 'statut'];

  newCompte = { nom: '', banque: '', numeroCompte: '', type: 'STE' };
  showNewCompteForm = false;

  constructor(private http: HttpClient, private snack: MatSnackBar) {}

  ngOnInit() {
    this.loadComptes();
    this.loadRapprochement();
    this.loadAllTransactions();
  }

  loadComptes() {
    this.http.get<any[]>(`${this.api}/comptes`).subscribe({
      next: (res) => this.comptes.set(res),
      error: () => this.snack.open('Erreur chargement comptes', 'X', { duration: 3000 })
    });
  }

  loadAllTransactions() {
    this.http.get<any[]>(`${this.api}/transactions`).subscribe({
      next: (res) => {
        this.allTransactions.set(res || []);
        const months = new Set<string>();
        (res || []).forEach((t: any) => {
          if (t.dateTransaction) {
            months.add(t.dateTransaction.substring(0, 7)); // YYYY-MM
          }
        });
        const sortedMonths = Array.from(months).sort().reverse();
        this.availableMonths.set(sortedMonths);
        if (sortedMonths.length > 0 && !this.selectedMonth()) {
          this.selectedMonth.set(sortedMonths[0]);
        }
      }
    });
  }

  clearRappFilters() {
    this.rappFilterMonth.set('');
    this.rappFilterStatutPaiement.set('REMIS_EN_BANQUE');
    this.rappFilterStatutDepense.set('REMIS_EN_BANQUE');
  }

    loadRapprochement() {
    this.http.get<any>(`${this.api}/rapprochement`).subscribe({
      next: (res) => {
        this.transactions.set(res.transactions || []);
        this.paiementsAttente.set(res.paiements || []);
        this.depensesAttente.set(res.depenses || []);
      }
    });
  }

  deleteReleve(id: string) {
    if(confirm('Êtes-vous sûr de vouloir supprimer ce relevé et toutes ses transactions associées ? Le solde sera recalculé.')) {
      this.http.delete(`${this.api}/releves/${id}`).subscribe({
        next: () => {
          this.snack.open('Relevé supprimé avec succès', 'V', { duration: 3000 });
          this.loadComptes();
          this.loadAllTransactions();
          this.loadRapprochement();
        },
        error: () => this.snack.open('Erreur lors de la suppression', 'X', { duration: 3000 })
      });
    }
  }

  createCompte() {
    this.http.post(`${this.api}/comptes`, this.newCompte).subscribe({
      next: () => {
        this.snack.open('Compte créé avec succès !', 'V', { duration: 3000 });
        this.showNewCompteForm = false;
        this.newCompte = { nom: '', banque: '', numeroCompte: '', type: 'STE' };
        this.loadComptes();
      },
      error: () => this.snack.open('Erreur création compte', 'X', { duration: 3000 })
    });
  }

  triggerAutoRapprochement() {
    this.loading.set(true);
    this.http.post<any>(`${this.api}/rapprochement/auto`, {}).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.snack.open(`${res.matchedCount} transactions rapproch�es automatiquement !`, 'OK', { duration: 5000 });
        this.loadRapprochement();
        this.loadAllTransactions();
      },
      error: (err) => {
        this.loading.set(false);
        this.snack.open('Erreur lors du rapprochement automatique', 'X', { duration: 3000 });
      }
    });
  }

  onFileSelected(event: any, compteId?: string) {
    const file: File = event.target.files[0];
    if (!file) return;
    this.loading.set(true);
    const formData = new FormData();
    formData.append('file', file);
    if (compteId) {
      formData.append('compteId', compteId);
    }
    this.http.post<any>(`${this.api}/releves/import`, formData).subscribe({
      next: (res) => {
        if (res.autoCreated) {
          this.snack.open('Nouveau compte bancaire créé automatiquement et relevé importé !', 'V', { duration: 5000 });
        } else {
          this.snack.open('Relevé importé et rapproché avec succès !', 'V', { duration: 4000 });
        }
        this.loadComptes();
        this.loadRapprochement();
        this.loadAllTransactions();
        this.loading.set(false);
      },
      error: (err) => {
        const errorMsg = err?.error?.message || 'Erreur lors de l\'import du relevé';
        this.snack.open(errorMsg, 'X', { duration: 4000 });
        this.loading.set(false);
      }
    });
  }

// --- RAPPROCHEMENT MANUEL ---
  selectedTx = signal<any>(null);

  selectTx(tx: any) {
    if (this.selectedTx()?.id === tx.id) {
      this.selectedTx.set(null); // deselect
    } else {
      this.selectedTx.set(tx);
    }
  }

  rapprochemantAvecPaiement(paiement: any) {
    const tx = this.selectedTx();
    if (!tx) {
      this.snack.open('Selectionnez d\'abord une transaction du releve !', 'X', { duration: 3000 });
      return;
    }
    if (tx.type !== 'CREDIT') {
      this.snack.open('Un paiement (encaissement) doit etre rapproche avec un CREDIT du releve.', 'X', { duration: 4000 });
      return;
    }
    this.http.post(`${this.api}/rapprochement/valider`, {
      transactionId: tx.id,
      typeMatched: 'PAIEMENT',
      matchedId: paiement.id
    }).subscribe({
      next: () => {
        this.snack.open('Rapprochement valide - Paiement encaisse !', 'V', { duration: 3000 });
        this.selectedTx.set(null);
        this.loadRapprochement();
        this.loadAllTransactions();
      },
      error: () => this.snack.open('Erreur lors du rapprochement', 'X', { duration: 3000 })
    });
  }

  rapprochemantAvecDepense(depense: any) {
    const tx = this.selectedTx();
    if (!tx) {
      this.snack.open('Selectionnez d\'abord une transaction du releve !', 'X', { duration: 3000 });
      return;
    }
    if (tx.type !== 'DEBIT') {
      this.snack.open('Une depense (decaissement) doit etre rapprochee avec un DEBIT du releve.', 'X', { duration: 4000 });
      return;
    }
    this.http.post(`${this.api}/rapprochement/valider`, {
      transactionId: tx.id,
      typeMatched: 'DEPENSE',
      matchedId: depense.id
    }).subscribe({
      next: () => {
        this.snack.open('Rapprochement valide - Depense marquee payee !', 'V', { duration: 3000 });
        this.selectedTx.set(null);
        this.loadRapprochement();
        this.loadAllTransactions();
      },
      error: () => this.snack.open('Erreur lors du rapprochement', 'X', { duration: 3000 })
    });
  }

  marquerSansContrepartie(tx: any) {
    if (!confirm('Marquer cette transaction comme rapprochee sans contrepartie systeme ?')) return;
    this.http.post(`${this.api}/rapprochement/valider`, {
      transactionId: tx.id,
      typeMatched: 'SANS_CONTREPARTIE'
    }).subscribe({
      next: () => {
        this.snack.open('Transaction marquee rapprochee (sans contrepartie)', 'V', { duration: 3000 });
        this.loadRapprochement();
        this.loadAllTransactions();
      },
      error: () => this.snack.open('Erreur', 'X', { duration: 3000 })
    });
  }

  exportExcel() {
    const txs = this.filteredTransactions();
    if (!txs || txs.length === 0) return;
    
    let csv = 'Date;Description;Type;Montant;Statut\n';
    txs.forEach(t => {
      const date = new Date(t.dateTransaction).toLocaleDateString();
      const desc = (t.description || '').replace(/;/g, ' ');
      const type = t.typeTransaction || t.type || '';
      const montant = t.montant;
      const signe = t.type === 'CREDIT' ? '+' : '-';
      const statut = t.statutRapprochement || '';
      csv += `${date};${desc};${type};${signe}${montant};${statut}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${this.selectedMonth() || 'global'}.csv`;
    link.click();
  }

  printTable() {
    window.print();
  }

  getTypeColor(type: string): string {
    return type === 'CREDIT' ? 'accent' : 'warn';
  }

  getStatutColor(statut: string): string {
    const map: Record<string, string> = {
      RAPPROCHE: 'primary',
      NON_RAPPROCHE: 'warn',
      ENCAISSE: 'accent',
    };
    return map[statut] || '';
  }
}




