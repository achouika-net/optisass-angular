import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { SupplierInvoiceListComponent } from '../supplier-invoice-list/supplier-invoice-list.component';
import { BcHistoryListComponent } from '../../components/bc-history-list/bc-history-list.component';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-bl-management-page',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    SupplierInvoiceListComponent,
    BcHistoryListComponent
  ],
  template: `
    <div class="bl-page-container">
      <div class="header mb-6 px-4 pt-4">
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <mat-icon color="primary">receipt_long</mat-icon>
          Gestion des Documents (BL & BC)
        </h1>
      </div>

      <mat-tab-group [selectedIndex]="selectedIndex" (selectedTabChange)="onTabChange($event)" class="custom-tabs">
        <mat-tab label="Bons de Livraison (BL)">
          <div class="mt-2">
            <app-supplier-invoice-list 
              listMode="BL" 
              [isSubComponent]="true"
              [showHeader]="true">
            </app-supplier-invoice-list>
          </div>
        </mat-tab>
        <mat-tab label="Historique BC">
          <div class="mt-2">
            <app-bc-history-list></app-bc-history-list>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; overflow-x: hidden; }
    .bl-page-container {
      width: 100%;
      max-width: 100%;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    .custom-tabs {
       width: 100%;
    }
  `]
})
export class BlManagementPageComponent implements OnInit {
  selectedIndex = 0;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'BC_HISTORY') {
        this.selectedIndex = 1;
      } else {
        this.selectedIndex = 0;
      }
    });
  }

  onTabChange(event: any): void {
    this.selectedIndex = event.index;
  }
}
