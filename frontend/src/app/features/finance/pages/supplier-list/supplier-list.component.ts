import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

@Component({
    selector: 'app-supplier-list',
    standalone: true,
    imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatTableModule],
    template: `
    <div class="container p-4">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold">Fournisseurs</h1>
        <button mat-raised-button color="primary">
          <mat-icon>add</mat-icon> Nouveau Fournisseur
        </button>
      </div>
      <mat-card>
        <p class="p-4">Liste des fournisseurs à venir...</p>
      </mat-card>
    </div>
  `
})
export class SupplierListComponent { }
