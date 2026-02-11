import { Component, OnInit, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
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
    .container { padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    table { width: 100%; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; }
    .montant-cell { font-weight: bold; }
    .chip-caisse { background-color: #e0f2f1; color: #00695c; }
    .chip-cheque { background-color: #fff3e0; color: #ef6c00; }
    .filters { display: flex; gap: 16px; align-items: center; margin-bottom: 24px; flex-wrap: wrap; }
    .filters mat-form-field { flex: 1; min-width: 200px; }
    ::ng-deep .dense-field .mat-mdc-form-field-subscript-wrapper { display: none; }
  `]
})
export class ExpenseListComponent implements OnInit {
  expenses: Expense[] = [];
  displayedColumns: string[] = ['date', 'categorie', 'description', 'centre', 'modePaiement', 'montant', 'actions'];
  loading = false;
  currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

  selectedPeriod = signal<string>('all');
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

  constructor(
    private financeService: FinanceService,
    private router: Router,
    private snackBar: MatSnackBar,
    private store: Store,
    private cdr: ChangeDetectorRef
  ) {
    effect(() => {
      const center = this.currentCentre();
      if (center?.id) {
        this.loadExpenses();
      }
    });

    effect(() => {
      this.selectedPeriod();
      this.loadExpenses();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    // Handled by effect
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
      endDate
    };

    this.financeService.getExpenses(filters).subscribe({
      next: (data) => {
        this.expenses = data;
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

  getModePaiementClass(mode: string): string {
    switch (mode) {
      case 'ESPECES': return 'chip-caisse';
      case 'CHEQUE': return 'chip-cheque';
      default: return '';
    }
  }
}
