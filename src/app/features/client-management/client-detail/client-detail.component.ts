import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { ClientService } from '../services/client.service';
import { FicheService } from '../services/fiche.service';
import { Client, TypeClient, ClientParticulier, ClientAnonyme } from '../models/client.model';
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
    MatTabsModule
  ],
  templateUrl: './client-detail.component.html',
  styleUrls: ['./client-detail.component.scss']
})
export class ClientDetailComponent implements OnInit {
  clientId: string | null = null;
  client: Client | null = null;
  fiches: FicheClient[] = [];
  loading = true;

  // Stats
  stats = {
    total: 0,
    enCours: 0,
    commande: 0,
    livre: 0,
    montantTotal: 0,
    montantRestant: 0
  };

  // Table columns
  displayedColumns: string[] = ['type', 'date', 'description', 'montant', 'statut', 'actions'];

  // Enums pour le template
  StatutFiche = StatutFiche;
  TypeFiche = TypeFiche;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientService,
    private ficheService: FicheService
  ) {
    this.clientId = this.route.snapshot.paramMap.get('id');
  }

  isClientPro(): boolean {
    return this.client?.typeClient === TypeClient.PROFESSIONNEL;
  }

  titleClient(): string {
    if (!this.clientParticulier) return 'Client';
    return `${this.clientParticulier.nom} ${this.clientParticulier.prenom}`;
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

  get clientAnonyme(): ClientAnonyme | null {
    return this.client && this.client.typeClient === TypeClient.ANONYME ? (this.client as ClientAnonyme) : null;
  }

  loadClientData(): void {
    if (!this.clientId) return;

    this.clientService.getClient(this.clientId).subscribe({
      next: (client) => {
        this.client = client || null;
        this.loading = false;
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
      next: (stats) => {
        this.stats = stats;
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
   * Voir/Éditer une fiche
   */
  viewFiche(fiche: FicheClient): void {
    const routePath = `fiche-${fiche.type}`;
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

  /**
   * Retour à la liste
   */
  goBack(): void {
    this.router.navigate(['/p/clients']);
  }
}
