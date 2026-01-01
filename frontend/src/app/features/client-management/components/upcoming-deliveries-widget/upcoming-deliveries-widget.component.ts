import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { FicheService } from '../../services/fiche.service';
import { ClientManagementService } from '../../services/client.service';
import { MessagingService } from '../../../../core/services/messaging.service';
import { MatSnackBar } from '@angular/material/snack-bar';

interface UpcomingDelivery {
  ficheId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  deliveryDate: Date;
  type: string;
  status: string;
}

@Component({
  selector: 'app-upcoming-deliveries-widget',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <mat-card class="upcoming-deliveries-widget">
      <mat-card-header>
        <mat-icon class="widget-icon">local_shipping</mat-icon>
        <mat-card-title>Livraisons à venir</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        @if (loading()) {
          <div class="loading-state">
            <mat-icon>hourglass_empty</mat-icon>
            <p>Chargement...</p>
          </div>
        } @else if (deliveries().length === 0) {
          <div class="empty-state">
            <mat-icon>check_circle</mat-icon>
            <p>Aucune livraison prévue pour aujourd'hui ou demain</p>
          </div>
        } @else {
          <div class="deliveries-list">
            @for (delivery of deliveries(); track delivery.ficheId) {
              <div class="delivery-item">
                <div class="delivery-info">
                  <div class="client-name">{{ delivery.clientName }}</div>
                  <div class="delivery-meta">
                    <span class="delivery-date">
                      <mat-icon>event</mat-icon>
                      {{ formatDate(delivery.deliveryDate) }}
                    </span>
                    <span class="delivery-type">{{ delivery.type }}</span>
                  </div>
                </div>
                <div class="delivery-actions">
                  <button 
                    mat-icon-button 
                    color="primary"
                    (click)="viewFiche(delivery)"
                    matTooltip="Voir la fiche">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  <button 
                    mat-icon-button 
                    (click)="sendDeliveryReady(delivery)"
                    matTooltip="Notifier: Prêt"
                    style="color: #25D366;">
                    <mat-icon>check_circle</mat-icon>
                  </button>
                  <button 
                    mat-icon-button 
                    color="warn"
                    (click)="sendDeliveryDelay(delivery)"
                    matTooltip="Notifier: Retard">
                    <mat-icon>schedule</mat-icon>
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .upcoming-deliveries-widget {
      height: 100%;
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .widget-icon {
      color: #1976d2;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    mat-card-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      color: #666;
      text-align: center;
    }

    .loading-state mat-icon, .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .deliveries-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .delivery-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .delivery-item:hover {
      background-color: #f5f5f5;
      border-color: #1976d2;
    }

    .delivery-info {
      flex: 1;
    }

    .client-name {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .delivery-meta {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 12px;
      color: #666;
    }

    .delivery-date {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .delivery-date mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .delivery-type {
      padding: 2px 8px;
      background-color: #e3f2fd;
      border-radius: 12px;
      font-size: 11px;
    }

    .delivery-actions {
      display: flex;
      gap: 4px;
    }
  `]
})
export class UpcomingDeliveriesWidgetComponent implements OnInit {
  deliveries = signal<UpcomingDelivery[]>([]);
  loading = signal(true);

  constructor(
    private ficheService: FicheService,
    private clientService: ClientManagementService,
    private messagingService: MessagingService,
    private snackBar: MatSnackBar,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadUpcomingDeliveries();
  }

  loadUpcomingDeliveries() {
    this.loading.set(true);

    // Get today and tomorrow dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // We need to load all clients first, then get their fiches
    // This is not optimal but works for MVP. Better approach: backend endpoint for upcoming deliveries
    this.clientService.getClients().subscribe({
      next: (clients: any[]) => {
        const upcoming: UpcomingDelivery[] = [];
        let processedClients = 0;

        if (clients.length === 0) {
          this.loading.set(false);
          return;
        }

        clients.forEach(client => {
          this.ficheService.getFichesByClient(client.id).subscribe({
            next: (fiches: any[]) => {
              for (const fiche of fiches) {
                if (fiche.dateLivraisonEstimee) {
                  const deliveryDate = new Date(fiche.dateLivraisonEstimee);
                  deliveryDate.setHours(0, 0, 0, 0);

                  // Check if delivery is today or tomorrow
                  if (deliveryDate >= today && deliveryDate < dayAfterTomorrow) {
                    const clientName = this.getClientName(client);
                    upcoming.push({
                      ficheId: fiche.id,
                      clientId: fiche.clientId,
                      clientName,
                      clientPhone: client.telephone || '',
                      deliveryDate: new Date(fiche.dateLivraisonEstimee),
                      type: fiche.type || 'Monture',
                      status: fiche.statut || 'En cours'
                    });
                  }
                }
              }

              processedClients++;
              if (processedClients === clients.length) {
                // Sort by date
                upcoming.sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime());
                this.deliveries.set(upcoming);
                this.loading.set(false);
              }
            },
            error: (err: any) => {
              console.error('Error loading fiches for client:', client.id, err);
              processedClients++;
              if (processedClients === clients.length) {
                this.loading.set(false);
              }
            }
          });
        });
      },
      error: (err: any) => {
        console.error('Error loading clients:', err);
        this.loading.set(false);
      }
    });
  }

  getClientName(client: any): string {
    if (client.typeClient === 'professionnel') {
      return client.raisonSociale || 'Client professionnel';
    }
    const nom = client.nom || '';
    const prenom = client.prenom || '';
    return prenom ? `${nom} ${prenom}` : nom || 'Client';
  }

  formatDate(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deliveryDate = new Date(date);
    deliveryDate.setHours(0, 0, 0, 0);

    if (deliveryDate.getTime() === today.getTime()) {
      return "Aujourd'hui";
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (deliveryDate.getTime() === tomorrow.getTime()) {
      return 'Demain';
    }

    return deliveryDate.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }

  viewFiche(delivery: UpcomingDelivery) {
    this.router.navigate(['/p/clients', delivery.clientId]);
  }

  sendDeliveryReady(delivery: UpcomingDelivery) {
    if (!delivery.clientPhone) {
      this.snackBar.open('Ce client n\'a pas de numéro de téléphone', 'Fermer', { duration: 3000 });
      return;
    }

    this.messagingService.openWhatsApp(
      delivery.clientPhone,
      'DELIVERY_READY',
      { name: delivery.clientName }
    );
  }

  sendDeliveryDelay(delivery: UpcomingDelivery) {
    if (!delivery.clientPhone) {
      this.snackBar.open('Ce client n\'a pas de numéro de téléphone', 'Fermer', { duration: 3000 });
      return;
    }

    this.messagingService.openWhatsApp(
      delivery.clientPhone,
      'DELIVERY_DELAY',
      { name: delivery.clientName }
    );
  }
}
