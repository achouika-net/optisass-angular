import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-under-development',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        RouterModule
    ],
    template: `
    <div class="container p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold m-0 flex items-center gap-2">
          <mat-icon color="primary">{{ icon() }}</mat-icon>
          {{ title() }}
        </h1>
      </div>

      <mat-card>
        <mat-card-content>
          <div class="text-center py-12 text-gray-500">
            <mat-icon class="text-[64px] h-[64px] w-[64px] mb-6 opacity-50">construction</mat-icon>
            <h2 class="text-xl font-semibold mb-2">Module en cours de développement</h2>
            <p class="mb-6">Cette fonctionnalité sera bientôt disponible. En attendant, vous pouvez
              utiliser les autres fonctions du système.</p>

            <div class="flex justify-center gap-4">
              <button mat-stroked-button color="primary" routerLink="/p/dashboard">
                <mat-icon>dashboard</mat-icon>
                Tableau de bord
              </button>
              <button mat-stroked-button color="primary" routerLink="/p/clients">
                <mat-icon>people</mat-icon>
                Gestion Clients
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
    styles: [`
    :host {
      display: block;
    }
  `]
})
export class UnderDevelopmentComponent {
    title = input.required<string>();
    icon = input.required<string>();
}
