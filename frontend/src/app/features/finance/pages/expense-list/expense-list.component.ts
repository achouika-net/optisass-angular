import { Component, OnInit, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';

import { FinanceService } from '../../services/finance.service';
import { Expense } from '../../models/finance.models';
import { ExpenseFormDialogComponent } from '../../components/expense-form-dialog/expense-form-dialog.component';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    FormsModule
  ],
  templateUrl: './expense-list.component.html',
  styles: [`
    .container { padding: 20px; max-width: 100%; overflow-x: hidden; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    table { width: 100%; table-layout: fixed; border-radius: 8px; overflow: hidden; }
    th.mat-header-cell { 
        background-color: #3f51b5 !important; 
        color: white !important; 
        font-weight: 600;
        padding: 12px 8px !important;
    }
    .mat-column-date { width: 100px; }
    .mat-column-categorie { width: 130px; }
    .mat-column-centre { width: 130px; }
    .mat-column-modePaiement { width: 100px; text-align: center; }
    .mat-column-montant { width: 120px; }
    .mat-column-actions { width: 90px; }
    .mat-column-description { 
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .mat-column-description:hover {
        white-space: normal;
        overflow: visible;
        word-break: break-word;
    }
    .actions { display: flex; gap: 4px; justify-content: flex-end; }
    .montant-cell { font-weight: bold; }
    .filters { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; flex-wrap: wrap; }
    .filters mat-form-field { flex: 1; min-width: 150px; }
    ::ng-deep .dense-field .mat-mdc-form-field-subscript-wrapper { display: none; }
  `]
})
export class ExpenseListComponent implements OnInit {
  expenses: Expense[] = [];
  displayedColumns: string[] = ['date', 'categorie', 'description', 'centre', 'modePaiement', 'montant', 'actions'];
  loading = false;
  currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

  selectedPeriod = signal<string>('this-month');
  periods = [
    { value: 'all', label: 'Toutes les périodes' },
    { value: 'today', label: "Aujourd'hui" },
    { value: 'this-month', label: 'Ce mois-ci' },
    { value: 'last-month', label: 'Mois dernier' },
    { value: 'this-year', label: 'Cette année' },
    { value: 'custom', label: 'Plage personnalisée' }
  ];

  filters = {
    startDate: null as Date | null,
    endDate: null as Date | null
  };

  totalCount = 0;
  pageIndex = 0;
  pageSize = 10;
  
  subtotals = {
    count: 0,
    totalDepenses: 0
  };

  constructor(
    private financeService: FinanceService,
    private router: Router,
    private snackBar: MatSnackBar,
    private store: Store,
    private cdr: ChangeDetectorRef
  ) {
    effect(() => {
      const center = this.currentCentre();
      const period = this.selectedPeriod(); // Explicit dependency

      if (center?.id) {
        this.loadExpenses();
      }
    });
  }

  ngOnInit(): void {
  }

  loadExpenses() {
    this.loading = true;
    this.cdr.markForCheck();

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

    const filters = {
      centreId: this.currentCentre()?.id,
      startDate,
      endDate,
      page: this.pageIndex + 1,
      limit: this.pageSize
    };

    this.financeService.getExpenses(filters).subscribe({
      next: (res: any) => {
        console.log(`📦 [Expenses] Response type: ${Array.isArray(res) ? 'Array' : 'Object'}, total=${res?.total}`);
        if (res && !Array.isArray(res) && res.data !== undefined) {
          this.expenses = res.data || [];
          this.totalCount = Number(res.total);
        } else {
          this.expenses = Array.isArray(res) ? res : [];
          this.totalCount = this.expenses.length;
        }
        
        let total = 0;
        this.expenses.forEach(e => total += (Number(e.montant) || 0));
        this.subtotals = {
           count: this.totalCount,
           totalDepenses: total
        };

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement dépenses', err);
        this.snackBar.open('Erreur lors du chargement des dépenses', 'Fermer', { duration: 3000 });
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onPageChange(event: any) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadExpenses();
  }

  openExpenseDialog(expense?: Expense) {
    if (expense) {
      this.router.navigate(['/p/finance/expenses/edit', expense.id]);
    } else {
      this.router.navigate(['/p/finance/expenses/new']);
    }
  }

  createExpense(data: any) {
    // Adapter la date au format string ISO si nécessaire, ou laisser le service/backend gérer
    this.financeService.createExpense(data).subscribe({
      next: () => {
        this.snackBar.open('Dépense enregistrée', 'OK', { duration: 3000 });
        this.loadExpenses();
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Erreur lors de l\'enregistrement', 'Fermer', { duration: 3000 });
      }
    });
  }

  updateExpense(id: string, data: any) {
    this.financeService.updateExpense(id, data).subscribe({
      next: () => {
        this.snackBar.open('Dépense mise à jour', 'OK', { duration: 3000 });
        this.loadExpenses();
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Erreur lors de la mise à jour', 'Fermer', { duration: 3000 });
      }
    });
  }

  deleteExpense(expense: Expense) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer cette dépense de ${expense.montant} DH ?`)) {
      this.financeService.deleteExpense(expense.id).subscribe({
        next: () => {
          this.snackBar.open('Dépense supprimée', 'OK', { duration: 3000 });
          this.loadExpenses();
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  printTable() {
    if (!this.expenses || this.expenses.length === 0) {
      this.snackBar.open('Aucune donnée à imprimer', 'Fermer', { duration: 3000 });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.snackBar.open('Veuillez autoriser les pop-ups pour imprimer', 'Fermer', { duration: 3000 });
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>État des Dépenses & Achats</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 10px; line-height: 1.4; }
            h1 { text-align: center; color: #1e3a8a; margin-bottom: 20px; font-size: 14px; }
            p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; }
            td.amount { text-align: right; font-weight: bold; color: #dc2626; }
            .footer { margin-top: 30px; text-align: right; font-size: 0.9em; color: #666; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>État des Dépenses & Achats</h1>
          <p><strong>Période sélectionnée :</strong> ${this.periods.find(p => p.value === this.selectedPeriod())?.label || this.selectedPeriod()}</p>
          <p><strong>Date d'impression :</strong> ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
          
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Catégorie</th>
                <th>Description</th>
                <th>Centre</th>
                <th>Mode</th>
                <th style="text-align: right;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${this.expenses.map(e => `
                <tr>
                  <td>${new Date(e.date).toLocaleDateString('fr-FR')}</td>
                  <td>${e.categorie || '-'}</td>
                  <td>${e.description || '-'}</td>
                  <td>${e.centre?.nom || '-'}</td>
                  <td>${e.modePaiement || '-'}</td>
                  <td class="amount">-${Number(e.montant).toFixed(2)} DH</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th colspan="5" style="text-align: right; font-size: 1.1em;">Total</th>
                <th class="amount" style="font-size: 1.1em;">
                  -${this.expenses.reduce((sum, e) => sum + Number(e.montant), 0).toFixed(2)} DH
                </th>
              </tr>
            </tfoot>
          </table>
          
          <div class="footer">
            Document généré par Optisaas
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
