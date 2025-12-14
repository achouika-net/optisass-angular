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
import { FactureService } from '../services/facture.service';
import { Client, TypeClient, ClientParticulier, ClientProfessionnel, ClientAnonyme, StatutClient, isClientParticulier, isClientProfessionnel } from '../models/client.model';
import { FactureListComponent } from '../factures/facture-list/facture-list.component';
import { FicheClient, StatutFiche, TypeFiche } from '../models/fiche-client.model';
import { PaymentListComponent } from '../payments/payment-list/payment-list.component';

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
    FormsModule,
    FormsModule,
    FactureListComponent,
    PaymentListComponent
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
    private factureService: FactureService,
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

    this.factureService.findAll({ clientId: this.clientId }).subscribe({
      next: (factures) => {
        // Filter out cancelled invoices
        const activeFactures = factures.filter(f => f.statut !== 'ANNULEE');

        const ca = activeFactures.reduce((sum, f) => sum + f.totalTTC, 0);
        const reste = activeFactures.reduce((sum, f) => sum + f.resteAPayer, 0);
        const paiements = ca - reste;

        this.clientStats.set({
          ca,
          paiements,
          reste
        });
      },
      error: (error) => {
        console.error('Erreur chargement stats (factures):', error);
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

  getVerresSummary(fiche: any): string {
    if (!fiche.verres) return '-';
    const v = fiche.verres;

    if (v.differentODOG) {
      // Format for OD
      const odParts = [];
      if (v.marqueOD) odParts.push(v.marqueOD);
      if (v.matiereOD) odParts.push(v.matiereOD);
      if (v.indiceOD) odParts.push(`Indice ${v.indiceOD}`);
      if (v.traitementOD && v.traitementOD.length > 0) {
        odParts.push(Array.isArray(v.traitementOD) ? v.traitementOD.join(', ') : v.traitementOD);
      }
      const od = odParts.join(' | ');

      // Format for OG
      const ogParts = [];
      if (v.marqueOG) ogParts.push(v.marqueOG);
      if (v.matiereOG) ogParts.push(v.matiereOG);
      if (v.indiceOG) ogParts.push(`Indice ${v.indiceOG}`);
      if (v.traitementOG && v.traitementOG.length > 0) {
        ogParts.push(Array.isArray(v.traitementOG) ? v.traitementOG.join(', ') : v.traitementOG);
      }
      const og = ogParts.join(' | ');

      return `OD: ${od}\nOG: ${og}`;
    } else {
      // Single lens configuration
      const parts = [];
      if (v.marque) parts.push(v.marque);
      if (v.matiere) parts.push(v.matiere);
      if (v.indice) parts.push(`Indice ${v.indice}`);
      if (v.traitement && v.traitement.length > 0) {
        parts.push(Array.isArray(v.traitement) ? v.traitement.join(', ') : v.traitement);
      }
      return parts.join(' | ');
    }
  }

  getCorrectionSummary(fiche: any): string {
    // Hide correction for Solaire (non-corrective)
    if (fiche.monture?.typeEquipement === 'Solaire') {
      return '';
    }

    if (!fiche.ordonnance) return '-';
    const od = fiche.ordonnance.od;
    const og = fiche.ordonnance.og;

    const formatEye = (eye: any) => {
      if (!eye) return '0.00 (0.00) 0° Add 0.00';

      // Sphere - always display
      let sphereStr = eye.sphere ? String(eye.sphere) : '0.00';
      let val = sphereStr;

      // Cylinder - always display in parentheses
      let cylStr = eye.cylindre ? String(eye.cylindre) : '0.00';
      val += ` (${cylStr})`;

      // Axis - always display with degree symbol
      if (eye.axe) {
        let axeStr = String(eye.axe);
        axeStr = axeStr.replace('°', '');
        val += ` ${axeStr}°`;
      } else {
        val += ` 00°`;
      }

      // Addition - always display
      if (eye.addition) {
        val += ` Add ${eye.addition}`;
      } else {
        val += ` Add 0.00`;
      }

      return val;
    };

    const odStr = formatEye(od);
    const ogStr = formatEye(og);

    return `OD: ${odStr}\nOG: ${ogStr}`;
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
