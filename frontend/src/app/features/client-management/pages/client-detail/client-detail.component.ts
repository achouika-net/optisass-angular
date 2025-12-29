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
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { ClientManagementService } from '../../services/client.service';
import { FicheService } from '../../services/fiche.service';
import { FactureService } from '../../services/facture.service';
import { LoyaltyService, PointsHistory } from '../../services/loyalty.service';
import { Client, TypeClient, ClientParticulier, ClientProfessionnel, ClientAnonyme, StatutClient, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { FactureListComponent } from '../facture-list/facture-list.component';
import { FicheClient, StatutFiche, TypeFiche } from '../../models/fiche-client.model';
import { PaymentListComponent } from '../../components/payment-list/payment-list.component';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  date: string;
  size?: number;
}

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
    MatDialogModule,
    MatMenuModule,
    MatDividerModule,
    FormsModule,
    FactureListComponent,
    PaymentListComponent,
    MatSnackBarModule,
    MatTooltipModule
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

  // Attachments Support
  attachments = signal<Attachment[]>([]);

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

  formatClientName(client: Client | any): string {
    if (!client) return '';
    if (client.typeClient === TypeClient.PROFESSIONNEL || client.raisonSociale) {
      return client.raisonSociale;
    }
    return `${client.nom || ''} ${client.prenom || ''}`.trim();
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

  // Loyalty History
  pointsHistory = signal<PointsHistory[]>([]);

  // Table columns
  historyColumns: string[] = ['dateLivraison', 'type', 'dateCreation', 'docteur', 'typeEquipement', 'typeVerre', 'nomenclature', 'actions'];

  // Enums pour le template
  StatutFiche = StatutFiche;
  TypeFiche = TypeFiche;
  StatutClient = StatutClient;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientService: ClientManagementService,
    private ficheService: FicheService,
    private factureService: FactureService,
    private loyaltyService: LoyaltyService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
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

  // Rewards
  isEligibleForReward = false;
  rewardThreshold = 0;

  loadClientData(): void {
    if (!this.clientId) return;

    this.clientService.getClient(this.clientId).subscribe({
      next: (client) => {
        this.client = client || null;
        if (client && (client as any).pointsHistory) {
          this.pointsHistory.set((client as any).pointsHistory);
        }

        // Load attachments from JSON field
        const dossierMedical = (client as any).dossierMedical || {};
        const clientAttachments = dossierMedical.attachments || [];
        this.attachments.set(clientAttachments);

        // Check reward eligibility
        this.checkRewardEligibility();

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
        this.cdr.markForCheck();
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
        const activeFactures = factures.filter(f => f.statut !== 'ANNULEE');
        const ca = activeFactures.reduce((sum, f) => {
          if (f.type === 'FACTURE' || (f.type === 'DEVIS' && (f.statut === 'VENTE_EN_INSTANCE' || f.statut === 'ARCHIVE'))) {
            return sum + f.totalTTC;
          }
          return sum;
        }, 0);
        const reste = activeFactures.reduce((sum, f) => {
          if (f.type === 'FACTURE' || (f.type === 'DEVIS' && (f.statut === 'VENTE_EN_INSTANCE' || f.statut === 'ARCHIVE'))) {
            const val = typeof f.resteAPayer === 'string' ? parseFloat(f.resteAPayer) : (f.resteAPayer || 0);
            return sum + val;
          }
          return sum;
        }, 0);
        const paiements = ca - reste;
        this.clientStats.set({ ca, paiements, reste });
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Erreur chargement stats (factures):', error);
      }
    });
  }

  get parrain(): any {
    return (this.client as any)?.parrain;
  }

  get filleuls(): any[] {
    return (this.client as any)?.filleuls || [];
  }

  createFicheMonture(): void {
    this.router.navigate(['/p/clients', this.clientId, 'fiche-monture', 'new']);
  }

  createFicheLentilles(): void {
    this.router.navigate(['/p/clients', this.clientId, 'fiche-lentilles', 'new']);
  }

  getVerresSummary(fiche: any): string {
    if (!fiche.verres) return '-';
    const v = fiche.verres;
    if (v.differentODOG) {
      const odParts = [];
      if (v.marqueOD) odParts.push(v.marqueOD);
      if (v.matiereOD) odParts.push(v.matiereOD);
      if (v.indiceOD) odParts.push(`Indice ${v.indiceOD}`);
      if (v.traitementOD && v.traitementOD.length > 0) {
        odParts.push(Array.isArray(v.traitementOD) ? v.traitementOD.join(', ') : v.traitementOD);
      }
      const od = odParts.join(' | ');
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
    if (fiche.monture?.typeEquipement === 'Solaire') return '';
    if (!fiche.ordonnance) return '-';
    const od = fiche.ordonnance.od;
    const og = fiche.ordonnance.og;
    const formatEye = (eye: any) => {
      if (!eye) return '0.00 (0.00) 0° Add 0.00';
      let sphereStr = eye.sphere ? String(eye.sphere) : '0.00';
      let val = sphereStr;
      let cylStr = eye.cylindre ? String(eye.cylindre) : '0.00';
      val += ` (${cylStr})`;
      if (eye.axe) {
        let axeStr = String(eye.axe).replace('°', '');
        val += ` ${axeStr}°`;
      } else {
        val += ` 00°`;
      }
      if (eye.addition) {
        val += ` Add ${eye.addition}`;
      } else {
        val += ` Add 0.00`;
      }
      return val;
    };
    return `OD: ${formatEye(od)}\nOG: ${formatEye(og)}`;
  }

  createFicheProduit(): void {
    this.router.navigate(['/p/clients', this.clientId, 'fiche-produit', 'new']);
  }

  viewFiche(fiche: FicheClient): void {
    const routePath = `fiche-${fiche.type.toLowerCase()}`;
    this.router.navigate(['/p/clients', this.clientId, routePath, fiche.id]);
  }

  editClientFiche(fiche: FicheClient): void {
    const routePath = `fiche-${fiche.type.toLowerCase()}`;
    this.router.navigate(['/p/clients', this.clientId, routePath, fiche.id]);
  }

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

  getStatutColor(statut: StatutFiche): string {
    switch (statut) {
      case StatutFiche.EN_COURS: return 'accent';
      case StatutFiche.COMMANDE: return 'primary';
      case StatutFiche.LIVRE: return '';
      case StatutFiche.ANNULE: return 'warn';
      default: return '';
    }
  }

  getStatutLabel(statut: StatutFiche): string {
    switch (statut) {
      case StatutFiche.EN_COURS: return 'En cours';
      case StatutFiche.COMMANDE: return 'Commandé';
      case StatutFiche.LIVRE: return 'Livré';
      case StatutFiche.ANNULE: return 'Annulé';
      default: return statut;
    }
  }

  getTypeIcon(type: TypeFiche): string {
    switch (type) {
      case TypeFiche.MONTURE: return 'visibility';
      case TypeFiche.LENTILLES: return 'remove_red_eye';
      case TypeFiche.PRODUIT: return 'shopping_cart';
      default: return 'description';
    }
  }

  completeProfile(): void {
    if (!this.clientId) return;
    this.router.navigate(['/p/clients', this.clientId, 'edit']);
  }

  // --- Header Actions ---

  createFacture(): void {
    this.router.navigate(['/p/clients/factures/new'], {
      queryParams: { clientId: this.clientId }
    });
  }

  // --- Attachment Methods ---

  openCamera(): void {
    const dialogRef = this.dialog.open(CameraCaptureDialogComponent, {
      width: '600px',
      maxWidth: '95vw'
    });

    dialogRef.afterClosed().subscribe(dataUrl => {
      if (dataUrl) {
        this.saveAttachment({
          id: crypto.randomUUID(),
          name: `Photo_${new Date().getTime()}.jpg`,
          type: 'image/jpeg',
          url: dataUrl,
          date: new Date().toISOString()
        });
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.saveAttachment({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          url: e.target.result,
          date: new Date().toISOString(),
          size: file.size
        });
      };
      reader.readAsDataURL(file);
    }
  }

  private saveAttachment(newFile: any): void {
    if (!this.client || !this.clientId) return;

    const currentAttachments = this.attachments();
    const updatedAttachments = [...currentAttachments, newFile];

    // Persist in dossierMedical JSON
    const updatedDossierMedical = {
      ...(this.client as any).dossierMedical,
      attachments: updatedAttachments
    };

    this.clientService.updateClient(this.clientId, {
      dossierMedical: updatedDossierMedical
    } as any).subscribe({
      next: () => {
        this.attachments.set(updatedAttachments);
        this.snackBar.open('Fichier ajouté avec succès', 'Fermer', { duration: 3000 });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error saving attachment:', err);
        this.snackBar.open('Erreur lors de l\'ajout du fichier', 'Fermer', { duration: 3000 });
      }
    });
  }

  deleteAttachment(attachmentId: string): void {
    if (!confirm('Voulez-vous vraiment supprimer ce fichier ?')) return;
    if (!this.client || !this.clientId) return;

    const updatedAttachments = this.attachments().filter(a => a.id !== attachmentId);

    const updatedDossierMedical = {
      ...(this.client as any).dossierMedical,
      attachments: updatedAttachments
    };

    this.clientService.updateClient(this.clientId, {
      dossierMedical: updatedDossierMedical
    } as any).subscribe({
      next: () => {
        this.attachments.set(updatedAttachments);
        this.snackBar.open('Fichier supprimé', 'Fermer', { duration: 3000 });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error deleting attachment:', err);
        this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
      }
    });
  }

  downloadAttachment(attachment: any): void {
    // For images/PDFs in dataUrl, we can open in new tab or trigger download
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name;
    link.click();
  }

  getFileIcon(type: string): string {
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'picture_as_pdf';
    return 'insert_drive_file';
  }

  toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
  }

  saveClient(): void {
    if (!this.clientId) return;
    this.isEditMode = false;
  }

  deleteClient(): void {
    if (!this.clientId) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer ce client ?\n\nAttention: Cette action supprimera également tous les dossiers associés non-facturés.')) {
      this.clientService.deleteClient(this.clientId).subscribe({
        next: () => this.router.navigate(['/p/clients']),
        error: (err) => alert(err.error?.message || err.message || 'Impossible de supprimer ce client.')
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
        error: (err) => alert(err.error?.message || err.message || 'Impossible de supprimer cette fiche.')
      });
    }
  }

  // --- Loyalty Methods ---

  checkRewardEligibility(): void {
    if (!this.clientId) return;
    console.log('[REWARD] Checking eligibility for client:', this.clientId);
    this.loyaltyService.checkRewardEligibility(this.clientId).subscribe({
      next: (result) => {
        console.log('[REWARD] Eligibility result:', result);
        this.isEligibleForReward = result.eligible;
        this.rewardThreshold = result.threshold;
        console.log('[REWARD] isEligibleForReward:', this.isEligibleForReward, 'threshold:', this.rewardThreshold);
        this.cdr.markForCheck();
      },
      error: (err) => console.error('[REWARD] Error checking eligibility:', err)
    });
  }

  redeemRewardWithType(type: 'DISCOUNT' | 'MAD_BONUS'): void {
    if (!this.clientId) return;
    const msg = type === 'DISCOUNT'
      ? 'Confirmez-vous échanger vos points contre une REMISE sur facture ?'
      : 'Confirmez-vous échanger vos points contre un BONUS en Dirhams ?';

    if (!confirm(msg)) return;

    this.loyaltyService.redeemReward(this.clientId, type).subscribe({
      next: () => {
        alert('Récompense appliquée avec succès !');
        this.loadClientData(); // Reload points
        this.isEligibleForReward = false;
      },
      error: (err) => alert('Erreur lors de l\'échange de points: ' + err.message)
    });
  }

  goBack(): void {
    this.router.navigate(['/p/clients']);
  }
}
