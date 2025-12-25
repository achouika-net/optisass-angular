import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FinanceService } from '../../services/finance.service';
import { Expense } from '../../models/finance.models';
import { ExpenseFormDialogComponent } from '../../components/expense-form-dialog/expense-form-dialog.component';

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule
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
  `]
})
export class ExpenseListComponent implements OnInit {
  expenses: Expense[] = [];
  displayedColumns: string[] = ['date', 'categorie', 'description', 'centre', 'modePaiement', 'montant', 'actions'];
  loading = false;

  constructor(
    private financeService: FinanceService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.loadExpenses();
  }

  loadExpenses() {
    this.loading = true;
    this.financeService.getExpenses().subscribe({
      next: (data) => {
        this.expenses = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur chargement dépenses', err);
        this.snackBar.open('Erreur lors du chargement des dépenses', 'Fermer', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  openExpenseDialog(expense?: Expense) {
    const dialogRef = this.dialog.open(ExpenseFormDialogComponent, {
      width: '600px',
      data: { expense }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (expense) {
          this.updateExpense(expense.id, result);
        } else {
          this.createExpense(result);
        }
      }
    });
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
