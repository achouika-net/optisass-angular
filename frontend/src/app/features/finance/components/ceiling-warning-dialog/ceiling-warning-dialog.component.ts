import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';

export interface CeilingWarningData {
    amount: number;
    currentDetails: {
        totalExpenses: number;
        monthlyThreshold: number;
        balance: number;
    };
    projection: { month: number; totalExpenses: number }[];
    currentMonth: number; // 0-based
    currentYear: number;
}

export type CeilingWarningAction = 'FORCE' | 'RESCHEDULE' | 'CANCEL';

@Component({
    selector: 'app-ceiling-warning-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        ReactiveFormsModule,
        MatSelectModule,
        MatFormFieldModule
    ],
    template: `
    <div class="flex flex-col max-h-[90vh]">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 bg-red-50 border-b border-red-100">
            <div class="flex items-center gap-4">
                <div class="p-3 bg-red-100 text-red-600 rounded-full">
                    <mat-icon class="scale-125">warning</mat-icon>
                </div>
                <div>
                    <h2 class="text-lg font-bold text-red-700 m-0">Dépassement du Seuil de Dépenses</h2>
                    <p class="text-sm text-red-500 font-medium">Attentionné requise pour cette opération</p>
                </div>
            </div>
            <button mat-icon-button (click)="close('CANCEL')" class="text-red-400 hover:text-red-700">
                <mat-icon>close</mat-icon>
            </button>
        </div>

        <!-- Content -->
        <div class="p-8 space-y-6">
            <div class="bg-white p-6 rounded-xl border-2 border-slate-100 shadow-sm">
                <p class="text-slate-600 mb-4 leading-relaxed">
                    L'ajout de cette dépense de <strong class="text-slate-900">{{ data.amount | number:'1.2-2' }} DH</strong> 
                    portera le total mensuel à <strong class="text-red-600">{{ (data.currentDetails.totalExpenses + data.amount) | number:'1.2-2' }} DH</strong>, 
                    ce qui dépasse votre seuil autorisé de <strong class="text-slate-900">{{ data.currentDetails.monthlyThreshold | number:'1.2-2' }} DH</strong>.
                </p>

                <div class="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <mat-icon class="text-slate-400">info</mat-icon>
                    <span class="text-xs text-slate-500 font-medium">
                        Vous pouvez choisir de planifier le paiement pour un mois ultérieur où le budget est disponible.
                    </span>
                </div>
            </div>

            <!-- Reschedule Option -->
            <div *ngIf="availableSlots.length > 0" class="space-y-3">
                <label class="text-sm font-bold text-slate-700 uppercase tracking-wide">Option Recommandée : Planifier le paiement</label>
                <div class="flex items-center gap-4">
                    <mat-form-field appearance="outline" class="flex-1" subscriptSizing="dynamic">
                        <mat-label>Mois de paiement</mat-label>
                        <mat-select [formControl]="selectedMonthControl">
                            <mat-option *ngFor="let slot of availableSlots" [value]="slot.date">
                                <span class="font-bold">{{ slot.label }}</span>
                                <span class="text-xs ml-2" [ngClass]="slot.available >= data.amount ? 'text-green-500' : 'text-slate-400'">
                                    (Dépenses: {{ slot.totalExpenses | number:'1.0-0' }} DH)
                                </span>
                                <mat-icon *ngIf="slot.available >= data.amount" class="text-green-400 scale-75 ml-1">check_circle</mat-icon>
                            </mat-option>
                        </mat-select>
                    </mat-form-field>
                    <button mat-flat-button color="primary" 
                            class="!h-12 !rounded-lg !px-6"
                            (click)="confirmReschedule()">
                        Déplacer au {{ getSelectedMonthLabel() }}
                    </button>
                </div>
                <p *ngIf="availableSlots[0].available < data.amount" class="text-[11px] text-orange-600 font-medium italic">
                    Note: Aucun mois n'a un budget complet, mais nous proposons celui avec le moins de dépenses.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div class="p-6 bg-slate-50 border-t flex justify-between items-center">
            <button mat-button color="warn" class="!font-bold" (click)="close('FORCE')">
                Ignorer et Forcer l'ajout
            </button>
            <button mat-stroked-button (click)="close('CANCEL')">
                Annuler
            </button>
        </div>
    </div>
    `
})
export class CeilingWarningDialogComponent implements OnInit {
    availableSlots: { date: Date, label: string, available: number, totalExpenses: number }[] = [];
    selectedMonthControl = new FormControl<Date | null>(null);

    constructor(
        public dialogRef: MatDialogRef<CeilingWarningDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CeilingWarningData
    ) { }

    ngOnInit() {
        this.calculateAvailableSlots();
    }

    calculateAvailableSlots() {
        const threshold = this.data.currentDetails.monthlyThreshold;

        // Collect all months to find the "best" one, even if none are perfectly below threshold
        let startMonthIdx = this.data.currentMonth + 1; // Next month

        for (let i = startMonthIdx; i < 12; i++) {
            const projectedExpenses = this.data.projection[i]?.totalExpenses || 0;
            const available = threshold - projectedExpenses;

            const date = new Date(this.data.currentYear, i, 1);
            const today = new Date();
            date.setDate(Math.min(today.getDate(), this.daysInMonth(i + 1, this.data.currentYear)));

            this.availableSlots.push({
                date: date,
                label: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
                available: available,
                totalExpenses: projectedExpenses
            });
        }

        // SMART SELECTION:
        // 1. Find the first month that fits perfectly (available >= amount)
        const bestFittingIdx = this.availableSlots.findIndex(s => s.available >= this.data.amount);

        if (bestFittingIdx !== -1) {
            console.log(`[Ceiling] Auto-selecting earliest viable month: ${this.availableSlots[bestFittingIdx].label}`);
            this.selectedMonthControl.setValue(this.availableSlots[bestFittingIdx].date);
        } else if (this.availableSlots.length > 0) {
            // 2. Fallback: Find the month with the actual lowest total expenses
            const fallbackSlot = [...this.availableSlots].sort((a, b) => a.totalExpenses - b.totalExpenses)[0];
            console.log(`[Ceiling] No month perfectly fits. Fallback to lowest expense month: ${fallbackSlot.label}`);
            this.selectedMonthControl.setValue(fallbackSlot.date);
        }
    }

    daysInMonth(month: number, year: number) {
        return new Date(year, month, 0).getDate();
    }

    getSelectedMonthLabel() {
        const val = this.selectedMonthControl.value;
        if (!val) return '...';
        return val.toLocaleDateString('fr-FR', { month: 'long' });
    }

    confirmReschedule() {
        if (this.selectedMonthControl.value) {
            this.dialogRef.close({ action: 'RESCHEDULE', date: this.selectedMonthControl.value });
        }
    }

    close(action: CeilingWarningAction) {
        this.dialogRef.close({ action });
    }
}
