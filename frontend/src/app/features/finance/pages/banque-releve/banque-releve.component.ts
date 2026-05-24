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
  ],
  templateUrl: './banque-releve.component.html',
  styleUrl: './banque-releve.component.scss',
})
export class BanqueReleveComponent implements OnInit {
  private api = `${environment.apiUrl}/api/banque`;

  comptes = signal<any[]>([]);
  transactions = signal<any[]>([]);
  paiementsAttente = signal<any[]>([]);
  selectedCompteId = signal<string>('');
  allTransactions = signal<any[]>([]);
  availableMonths = signal<string[]>([]);
  selectedMonth = signal<string>('');
  
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

  loadRapprochement() {
    this.http.get<any>(`${this.api}/rapprochement`).subscribe({
      next: (res) => {
        this.transactions.set(res.transactions || []);
        this.paiementsAttente.set(res.paiements || []);
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

  validerRapprochement(transactionId: string, paiementId: string) {
    this.http.post(`${this.api}/rapprochement/valider`, {
      transactionId,
      typeMatched: 'PAIEMENT',
      matchedId: paiementId
    }).subscribe({
      next: () => {
        this.snack.open('Rapprochement validé - Paiement encaissé !', 'V', { duration: 3000 });
        this.loadRapprochement();
        this.loadAllTransactions();
      }
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
