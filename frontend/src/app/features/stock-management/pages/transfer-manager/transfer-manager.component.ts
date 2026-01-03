import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { take, Subject, takeUntil, forkJoin } from 'rxjs';

@Component({
    selector: 'app-transfer-manager',
    standalone: true,
    imports: [
        CommonModule,
        MatTabsModule,
        MatTableModule,
        MatIconModule,
        MatButtonModule,
        MatSnackBarModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatProgressSpinnerModule,
        FormsModule
    ],
    templateUrl: './transfer-manager.component.html',
    styleUrl: './transfer-manager.component.scss'
})
export class TransferManagerComponent implements OnInit, OnDestroy {
    private readonly productService = inject(ProductService);
    private readonly store = inject(Store);
    private readonly snackBar = inject(MatSnackBar);
    private readonly cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    outgoingTransfers: any[] = [];
    incomingTransfers: any[] = [];
    transferHistory: any[] = [];
    currentCentreId: string | null = null;
    loading = false;
    loadingHistory = false;

    // Filters
    startDate: Date | null = null;
    endDate: Date | null = null;
    selectedPeriod: string = 'month';
    selectedType: string = '';

    availableTypes = [
        { value: '', label: 'Tous les types' },
        { value: 'TRANSFERT_SORTIE', label: 'Expédition' },
        { value: 'TRANSFERT_ENTREE', label: 'Réception' },
        { value: 'RECEPTION', label: 'Alimentation Stock' },
        { value: 'TRANSFERT_INIT', label: 'Initialisation' },
        { value: 'TRANSFERT_ANNULE', label: 'Annulé' }
    ];

    displayedColumns = ['numero', 'product', 'destination', 'quantity', 'date', 'status', 'actions'];
    incomingColumns = ['numero', 'product', 'source', 'quantity', 'date', 'status', 'actions'];
    historyColumns = ['date', 'numero', 'product', 'type', 'source', 'dest', 'qty', 'user'];

    ngOnInit(): void {
        const today = new Date();
        this.startDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start of month
        this.endDate = new Date();

        this.store.select(UserCurrentCentreSelector).pipe(
            takeUntil(this.destroy$)
        ).subscribe(center => {
            if (center) {
                this.currentCentreId = center.id;
                this.loadTransfers();
                this.loadHistory();
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadTransfers(): void {
        if (!this.currentCentreId) {
            console.warn('⚠️ [TRANSFER-DEBUG] No currentCentreId available.');
            return;
        }
        this.loading = true;
        console.log('🔄 [TRANSFER-DEBUG] Loading all products for center:', this.currentCentreId);

        this.productService.findAll({ global: true }).subscribe({
            next: (products) => {
                console.log(`📥 [TRANSFER-DEBUG] Received ${products.length} products (Global).`);

                // TARGETED DEBUG: Check the specific product from the logs
                const targetDebugId = '64d5e7ed-1369-43ca-800f-080a911e83f0';
                const debugProduct = products.find(p => p.id === targetDebugId);
                if (debugProduct) {
                    console.warn(`🕵️ [RAW-DUMP] Product ${targetDebugId} found!`);
                    console.warn('   Wh:', debugProduct.entrepot?.nom, 'Centre:', debugProduct.entrepot?.centreId);
                    console.warn('   SpecificData Type:', typeof debugProduct.specificData);
                    console.warn('   SpecificData Content:', JSON.stringify(debugProduct.specificData, null, 2));
                } else {
                    console.error(`❌ [RAW-DUMP] Product ${targetDebugId} NOT found in frontend list!`);
                }

                // DEBUG: Check for ANY product with pendingOutgoing
                const candidates = products.filter(p => p.specificData?.pendingOutgoing?.length > 0);
                console.log(`🧐 [TRANSFER-DEBUG] Found ${candidates.length} products with ANY pendingOutgoing globally.`,
                    candidates.map(c => ({
                        id: c.id,
                        wh: c.entrepot?.nom,
                        centre: c.entrepot?.centreId
                    }))
                );

                // Outgoing: center is current center and has pending outgoing
                this.outgoingTransfers = products
                    .filter(p => p.entrepot?.centreId === this.currentCentreId && p.specificData?.pendingOutgoing?.length > 0)
                    .flatMap(p => p.specificData.pendingOutgoing.map((t: any) => ({
                        ...t,
                        sourceProduct: p
                    })));

                console.log(`📤 [TRANSFER-DEBUG] Filtered Outgoing Transfers for this center: ${this.outgoingTransfers.length}`);

                // Incoming: center is current center and has pending incoming
                this.incomingTransfers = products
                    .filter(p => p.entrepot?.centreId === this.currentCentreId && p.specificData?.pendingIncoming)
                    .map(p => ({
                        ...p.specificData.pendingIncoming,
                        targetProduct: p
                    }));

                console.log(`📥 [TRANSFER-DEBUG] Filtered Incoming Transfers for this center: ${this.incomingTransfers.length}`);

                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.loading = false;
                console.error('Error loading transfers:', err);
            }
        });
    }

    loadHistory(): void {
        if (!this.currentCentreId) return;
        this.loadingHistory = true;

        const params = {
            startDate: this.startDate?.toISOString(),
            endDate: this.endDate?.toISOString(),
            centreId: this.currentCentreId,
            type: this.selectedType || undefined
        };

        this.productService.getTransferHistory(params).subscribe({
            next: (history) => {
                this.transferHistory = history;
                this.loadingHistory = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.loadingHistory = false;
                console.error('Error loading transfer history:', err);
            }
        });
    }

    onPeriodChange(): void {
        const today = new Date();
        switch (this.selectedPeriod) {
            case 'today':
                this.startDate = new Date(today.setHours(0, 0, 0, 0));
                this.endDate = new Date(today.setHours(23, 59, 59, 999));
                break;
            case 'week':
                const first = today.getDate() - today.getDay();
                this.startDate = new Date(today.setDate(first));
                this.startDate.setHours(0, 0, 0, 0);
                this.endDate = new Date();
                break;
            case 'month':
                this.startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                this.endDate = new Date();
                break;
            case 'year':
                this.startDate = new Date(today.getFullYear(), 0, 1);
                this.endDate = new Date();
                break;
        }
        this.loadHistory();
    }

    shipTransfer(transfer: any): void {
        if (!confirm(`Confirmer l'expédition de ${transfer.quantite}x ${transfer.sourceProduct.designation} ?`)) return;

        this.productService.shipTransfer(transfer.targetProductId).subscribe({
            next: () => {
                this.snackBar.open('Transfert expédié avec succès', 'Fermer', { duration: 3000 });
                this.loadTransfers();
            },
            error: (err) => {
                console.error('Error shipping transfer:', err);
                alert('Erreur lors de l\'expédition');
            }
        });
    }

    receiveTransfer(transfer: any): void {
        if (!confirm(`Confirmer la réception de ${transfer.quantite}x ${transfer.targetProduct.designation} ?`)) return;

        this.productService.completeTransfer(transfer.targetProduct.id).subscribe({
            next: () => {
                this.snackBar.open('Produit réceptionné et ajouté au stock', 'Fermer', { duration: 3000 });
                this.loadTransfers();
            },
            error: (err) => {
                console.error('Error receiving transfer:', err);
                alert('Erreur lors de la réception');
            }
        });
    }

    cancelTransfer(transfer: any): void {
        if (!confirm('Annuler ce transfert ?')) return;

        const productId = transfer.targetProductId || transfer.targetProduct?.id;
        this.productService.cancelTransfer(productId).subscribe({
            next: () => {
                this.snackBar.open('Transfert annulé', 'Fermer', { duration: 3000 });
                this.loadTransfers();
            },
            error: (err) => {
                console.error('Error cancelling transfer:', err);
                alert('Erreur lors de l\'annulation');
            }
        });
    }
}
