import { Component, OnInit, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../../../../config/api.config';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GlassParametersService } from '../../../client-management/services/glass-parameters.service';

@Component({
  selector: 'app-glass-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatDialogModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './glass-settings.component.html',
  styleUrls: ['./glass-settings.component.scss']
})
export class GlassSettingsComponent implements OnInit {
  brands: any[] = [];
  materials: any[] = [];
  treatments: any[] = [];
  
  loading = false;
  private apiUrl = `${API_URL}/glass-parameters`;

  constructor(
    private service: GlassParametersService,
    private snackBar: MatSnackBar,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll() {
    console.log('🔄 Loading glass parameters...');
    this.loading = true;
    this.service.getAll(true).subscribe({
      next: (data) => {
        console.log('✅ Glass parameters loaded:', data);
        this.brands = data.brands;
        this.materials = data.materials;
        this.treatments = data.treatments;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading glass parameters:', err);
        this.snackBar.open('Erreur lors du chargement des paramètres', 'OK', { duration: 3000 });
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // --- Brands ---
  addBrand() {
    const name = prompt('Nom de la marque :');
    if (name) {
      this.http.post(`${this.apiUrl}/brands`, { name }).subscribe(() => {
        this.snackBar.open('Marque ajoutée', 'OK', { duration: 2000 });
        this.loadAll();
      });
    }
  }

  deleteBrand(id: string) {
    if (confirm('Voulez-vous vraiment supprimer cette marque ?')) {
      this.http.delete(`${this.apiUrl}/brands/${id}`).subscribe(() => {
        this.loadAll();
      });
    }
  }

  // --- Materials ---
  addMaterial() {
    const name = prompt('Nom de la matière :');
    if (name) {
      this.http.post(`${this.apiUrl}/materials`, { name }).subscribe(() => {
        this.loadAll();
      });
    }
  }

  deleteMaterial(id: string) {
    if (confirm('Supprimer cette matière supprimera tous les indices associés. Continuer ?')) {
      this.http.delete(`${this.apiUrl}/materials/${id}`).subscribe(() => {
        this.loadAll();
      });
    }
  }

  // --- Indices ---
  addIndex(materialId: string) {
    const value = prompt('Valeur de l\'indice (ex: 1.50) :');
    const priceStr = prompt('Prix de base (MAD) :', '0');
    const price = parseFloat(priceStr || '0');
    
    if (value) {
      this.http.post(`${this.apiUrl}/indices`, { materialId, value, label: value, price }).subscribe(() => {
        this.loadAll();
      });
    }
  }

  updateIndexPrice(id: string, newPrice: string) {
    const price = parseFloat(newPrice);
    if (!isNaN(price)) {
      this.http.patch(`${this.apiUrl}/indices/${id}`, { price }).subscribe(() => {
        this.snackBar.open('Prix mis à jour', 'OK', { duration: 2000 });
      });
    }
  }

  deleteIndex(id: string) {
    if (confirm('Supprimer cet indice ?')) {
      this.http.delete(`${this.apiUrl}/indices/${id}`).subscribe(() => {
        this.loadAll();
      });
    }
  }

  // --- Treatments ---
  addTreatment() {
    const name = prompt('Nom du traitement :');
    const priceStr = prompt('Prix (MAD) :', '0');
    const price = parseFloat(priceStr || '0');
    
    if (name) {
      this.http.post(`${this.apiUrl}/treatments`, { name, price }).subscribe(() => {
        this.loadAll();
      });
    }
  }

  updateTreatmentPrice(id: string, newPrice: string) {
    const price = parseFloat(newPrice);
    if (!isNaN(price)) {
      this.http.patch(`${this.apiUrl}/treatments/${id}`, { price }).subscribe(() => {
        this.snackBar.open('Prix mis à jour', 'OK', { duration: 2000 });
      });
    }
  }

  deleteTreatment(id: string) {
    if (confirm('Supprimer ce traitement ?')) {
      this.http.delete(`${this.apiUrl}/treatments/${id}`).subscribe(() => {
        this.loadAll();
      });
    }
  }

  runSeed() {
    if (confirm('Voulez-vous charger les données par défaut ? Cela ajoutera les marques et verres standards.')) {
      this.http.get(`${this.apiUrl}/seed`).subscribe(() => {
        this.snackBar.open('Données chargées avec succès', 'OK', { duration: 3000 });
        this.loadAll();
      });
    }
  }

  // --- Stock Management ---
  adjustStock(type: 'index' | 'treatment', id: string, label: string) {
    const qtyStr = prompt(`Ajuster le stock pour "${label}" (ex: +10 ou -5) :`);
    if (!qtyStr) return;
    
    const delta = parseFloat(qtyStr);
    if (isNaN(delta)) {
      this.snackBar.open('Quantité invalide', 'OK', { duration: 2000 });
      return;
    }

    const motif = prompt('Motif de l\'ajustement (optionnel) :', 'Ajustement manuel inventory');
    
    const path = type === 'index' ? 'indices' : 'treatments';
    this.http.post(`${this.apiUrl}/${path}/${id}/stock`, { delta, motif }).subscribe({
      next: () => {
        this.snackBar.open('Stock mis à jour', 'OK', { duration: 2000 });
        this.loadAll();
      },
      error: () => this.snackBar.open('Erreur lors de la mise à jour', 'OK', { duration: 3000 })
    });
  }

  viewHistory(type: 'index' | 'treatment', id: string, label: string) {
    this.http.get<any[]>(`${this.apiUrl}/${type}/${id}/history`).subscribe({
      next: (history) => {
        this.dialog.open(StockHistoryDialogComponent, {
          width: '600px',
          data: { label, history }
        });
      },
      error: () => this.snackBar.open('Erreur lors du chargement de l\'historique', 'OK', { duration: 3000 })
    });
  }
}

@Component({
  selector: 'app-stock-history-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatTableModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Historique Stock: {{ data.label }}</h2>
    <mat-dialog-content>
      <table mat-table [dataSource]="data.history" class="w-full">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let m">{{ m.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
        </ng-container>
        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef>Type</th>
          <td mat-cell *matCellDef="let m">
            <span [class]="m.type === 'ENTREE' ? 'text-green-600' : 'text-red-600'">{{ m.type }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="qty">
          <th mat-header-cell *matHeaderCellDef>Qté</th>
          <td mat-cell *matCellDef="let m" class="font-bold">
            {{ m.quantite > 0 ? '+' : '' }}{{ m.quantite }}
          </td>
        </ng-container>
        <ng-container matColumnDef="motif">
          <th mat-header-cell *matHeaderCellDef>Motif</th>
          <td mat-cell *matCellDef="let m">{{ m.motif }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="['date', 'type', 'qty', 'motif']"></tr>
        <tr mat-row *matRowDef="let row; columns: ['date', 'type', 'qty', 'motif']"></tr>
      </table>
      <div *ngIf="data.history.length === 0" class="p-8 text-center text-slate-400">
        Aucun mouvement trouvé.
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fermer</button>
    </mat-dialog-actions>
  `
})
export class StockHistoryDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { label: string; history: any[] }) {}
}
