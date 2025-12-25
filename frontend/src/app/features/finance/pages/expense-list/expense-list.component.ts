import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-expense-list',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
    template: `
    <div class="container p-4">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold">Dépenses</h1>
        <button mat-raised-button color="primary">
          <mat-icon>add</mat-icon> Nouvelle Dépense
        </button>
      </div>
      <mat-card>
        <p class="p-4">Liste des dépenses à venir...</p>
      </mat-card>
    </div>
  `
})
export class ExpenseListComponent { }
