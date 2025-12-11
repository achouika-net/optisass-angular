import { Component, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { ClientService } from '../services/client.service';
import { FicheService } from '../services/fiche.service';
import { Client, TypeClient, ClientParticulier, ClientProfessionnel, ClientAnonyme, StatutClient, isClientParticulier, isClientProfessionnel } from '../models/client.model';
import { FicheClient, StatutFiche, TypeFiche } from '../models/fiche-client.model';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatRadioModule,
    FormsModule
  ],
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss']
})
export class ClientDetailComponent implements OnInit {
  clientId: string | null = null;
  client: Client | null = null;
  fiches: FicheClient[] = [];
  loading = true;
  isEditMode = false;

  get clientDisplayName(): string {
    if (!this.client) return '';

    if (isClientProfessionnel(this.client)) {
      return this.client.raisonSociale.toUpperCase();
    }

    if (isClientParticulier(this.client) || (this.client as any).nom) {
      const nom = (this.client as any).nom || '';
      const prenom = (this.client as any).prenom || '';
      return `${nom.toUpperCase()} ${this.toTitleCase(prenom)}`;
    }

    return '';
  }

  private toTitleCase(str: string): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }


  // Stats Signal
  clientStats = signal({
    ca: 0,
    paiements: 0,
    reste: 0
  });

  // Table columns
  historyColumns: string[] = ['type', 'dateCreation', 'dateLivraison', 'docteur', 'typeEquipement', 'typeVerre', 'nomenclature', 'actions'];

  // Enums pour le template
  StatutFiche = StatutFiche;
  TypeFiche = TypeFiche;
  StatutClient = StatutClient;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientService,
    private ficheService: FicheService,
    private cdr: ChangeDetectorRef
  ) {
    this.clientId = this.route.snapshot.paramMap.get('id');
  }

  ngOnInit(): void {
    if (this.clientId) {
      this.loadClientData();
      this.loadFiches();
      this.loadStats();
    }
  }

  get clientParticulier(): ClientParticulier | null {
    return this.client && this.client.typeClient === TypeClient.PARTICULIER ? (this.client as ClientParticulier) : null;
  }

  get clientProfessionnel(): ClientProfessionnel | null {
    return this.client && this.client.typeClient === TypeClient.PROFESSIONNEL ? (this.client as ClientProfessionnel) : null;
  }

  get clientAnonyme(): ClientAnonyme | null {
    return this.client && this.client.typeClient === TypeClient.ANONYME ? (this.client as ClientAnonyme) : null;
  }

  loadClientData(): void {
    if (!this.clientId) return;

    this.clientService.getClient(this.clientId).subscribe({
      next: (client) => {
        this.client = client || null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erreur chargement client:', error);
        this.loading = false;
      }
    });
  }

  loadFiches(): void {
    if (!this.clientId) return;

    this.ficheService.getFichesByClient(this.clientId).subscribe({
      next: (fiches) => {
        this.fiches = fiches;
      },
      error: (error) => {
        console.error('Erreur chargement fiches:', error);
      }
    });
  }

  loadStats(): void {
    if (!this.clientId) return;

    this.ficheService.getClientFichesStats(this.clientId).subscribe({
      next: (statsData: any) => {
        // Map backend stats to UI stats
        this.clientStats.set({
          ca: statsData.montantTotal || 0,
          paiements: (statsData.montantTotal || 0) - (statsData.montantRestant || 0),
          reste: statsData.montantRestant || 0
        });
      },
      error: (error) => {
        console.error('Erreur chargement stats:', error);
      }
    });
  }




  /**
   * Créer une nouvelle fiche monture
   */
  createFicheMonture(): void {
    this.router.navigate(['/p/clients', this.clientId, 'fiche-monture', 'new']);
  }

  /**
   * Créer une nouvelle fiche lentilles
   */
  createFicheLentilles(): void {
    this.router.navigate(['/p/clients', this.clientId, 'fiche-lentilles', 'new']);
  }

  /**
   * Créer une nouvelle fiche produit
   */
  createFicheProduit(): void {
    this.router.navigate(['/p/clients', this.clientId, 'fiche-produit', 'new']);
  }

  /**
   * Voir une fiche
   */
  viewFiche(fiche: FicheClient): void {
    const routePath = `fiche-${fiche.type.toLowerCase()}`; // Ensure lowercase
    this.router.navigate(['/p/clients', this.clientId, routePath, fiche.id]);
  }

  /**
   * Éditer une fiche
   */
  editClientFiche(fiche: FicheClient): void {
    const routePath = `fiche-${fiche.type.toLowerCase()}`;
    // Assuming edit route is same as view or appending /edit if supported
    this.router.navigate(['/p/clients', this.clientId, routePath, fiche.id]);
  }

  /**
   * Obtenir la description d'une fiche
   */
  getFicheDescription(fiche: FicheClient): string {
    switch (fiche.type) {
      case TypeFiche.MONTURE:
        return `${fiche.monture.marque} ${fiche.monture.modele}`;
      case TypeFiche.LENTILLES:
        return `${fiche.lentilles.od.marque} ${fiche.lentilles.od.modele}`;
      case TypeFiche.PRODUIT:
        return `${fiche.produits.length} produit(s)`;
      default:
        return '';
    }
  }

  /**
   * Obtenir la couleur du chip de statut
   */
  getStatutColor(statut: StatutFiche): string {
    switch (statut) {
      case StatutFiche.EN_COURS:
        return 'accent';
      case StatutFiche.COMMANDE:
        return 'primary';
      case StatutFiche.LIVRE:
        return '';
      case StatutFiche.ANNULE:
        return 'warn';
      default:
        return '';
    }
  }

  /**
   * Obtenir le label du statut
   */
  getStatutLabel(statut: StatutFiche): string {
    switch (statut) {
      case StatutFiche.EN_COURS:
        return 'En cours';
      case StatutFiche.COMMANDE:
        return 'Commandé';
      case StatutFiche.LIVRE:
        return 'Livré';
      case StatutFiche.ANNULE:
        return 'Annulé';
      default:
        return statut;
    }
  }

  /**
   * Obtenir l'icône du type de fiche
   */
  getTypeIcon(type: TypeFiche): string {
    switch (type) {
      case TypeFiche.MONTURE:
        return 'visibility';
      case TypeFiche.LENTILLES:
        return 'remove_red_eye';
      case TypeFiche.PRODUIT:
        return 'shopping_cart';
      default:
        return 'description';
    }
  }

  completeProfile(): void {
    if (!this.clientId) return;
    this.router.navigate(['/p/clients', this.clientId, 'edit']);
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
  }

  saveClient(): void {
    if (!this.clientId) return;
    // Implement save logic here if needed or relying on child components
    // For now, toggle back to view mode
    this.isEditMode = false;
  }

  deleteClient(): void {
    if (!this.clientId) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?\n\nAttention: Cette action supprimera également tous les dossiers associés non-facturés.')) {
      this.clientService.deleteClient(this.clientId).subscribe({
        next: () => {
          this.router.navigate(['/p/clients']);
        },
        error: (err) => {
          console.error('Erreur suppression client:', err);
          // Backend returns 500/400 with message, display it
          alert(err.error?.message || err.message || 'Impossible de supprimer ce client.');
        }
      });
    }
  }

  deleteFiche(fiche: FicheClient): void {
    if (confirm(`Voulez-vous vraiment supprimer ce dossier ${fiche.type} du ${new Date(fiche.dateCreation).toLocaleDateString()} ?`)) {
      this.ficheService.deleteFiche(fiche.id).subscribe({
        next: () => {
          this.loadFiches();
          this.loadStats();
        },
        error: (err) => {
          console.error('Erreur suppression fiche:', err);
          alert(err.error?.message || err.message || 'Impossible de supprimer cette fiche.');
        }
      });
    }
  }

  /**
   * Retour à la liste
   */
  goBack(): void {
    this.router.navigate(['/p/clients']);
  }
}
