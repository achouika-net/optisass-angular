import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
    private cdr: ChangeDetectorRef
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
}
