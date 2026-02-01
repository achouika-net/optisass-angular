import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms'; // Added FormsModule
import { PersonnelService } from '../services/personnel.service';
import { Chart, registerables } from 'chart.js';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../core/store/auth/auth.selectors';

Chart.register(...registerables);

@Component({
    selector: 'app-hr-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        FormsModule // Added FormsModule
    ],
    templateUrl: './hr-dashboard.component.html',
    styleUrls: ['./hr-dashboard.component.scss']
})
export class HRDashboardComponent implements OnInit, AfterViewInit {
    @ViewChild('massChart') massChartRef!: ElementRef;
    @ViewChild('posteChart') posteChartRef!: ElementRef;

    private massChart: Chart | null = null;
    private posteChart: Chart | null = null;

    stats: any = null;
    isLoading = true;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    // Filters
    months = [
        { value: '01', label: 'Janvier' },
        { value: '02', label: 'Février' },
        { value: '03', label: 'Mars' },
        { value: '04', label: 'Avril' },
        { value: '05', label: 'Mai' },
        { value: '06', label: 'Juin' },
        { value: '07', label: 'Juillet' },
        { value: '08', label: 'Août' },
        { value: '09', label: 'Septembre' },
        { value: '10', label: 'Octobre' },
        { value: '11', label: 'Novembre' },
        { value: '12', label: 'Décembre' }
    ];
    years: number[] = [];

    selectedMonth: string;
    selectedYear: number;

    constructor(
        private personnelService: PersonnelService,
        private store: Store,
        private cd: ChangeDetectorRef
    ) {
        const now = new Date();
        this.selectedMonth = now.toISOString().substring(5, 7);
        this.selectedYear = now.getFullYear();

        // Populate years (current year - 5 to current + 1)
        const currentYear = now.getFullYear();
        for (let i = currentYear - 5; i <= currentYear + 1; i++) {
            this.years.push(i);
        }
        // Ensure current year is selected if logic somehow fails or for consistency
        this.selectedYear = currentYear;
    }

    ngOnInit(): void {
        this.loadStats();
    }

    ngAfterViewInit(): void {
        // Initial load will trigger chart creation if data available
    }

    loadStats(): void {
        this.isLoading = true;
        const mois = this.selectedMonth;
        const annee = this.selectedYear;
        const centreId = (this.currentCentre() as any)?.id;

        this.personnelService.getDashboardStats(mois, annee, centreId).subscribe({
            next: (data) => {
                this.stats = data;
                this.isLoading = false;
                this.cd.detectChanges();
                setTimeout(() => this.initCharts(), 100);
            },
            error: (err) => {
                console.error('Error loading RH stats', err);
                this.isLoading = false;
            }
        });
    }

    initCharts(): void {
        if (!this.stats) return;

        // Cleanup existing charts
        if (this.massChart) this.massChart.destroy();
        if (this.posteChart) this.posteChart.destroy();

        // Évolution Masse Salariale Chart
        if (this.massChartRef) {
            const ctx = this.massChartRef.nativeElement.getContext('2d');
            this.massChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: this.stats.history.map((h: any) => h.label),
                    datasets: [
                        {
                            label: 'Salaire Net',
                            data: this.stats.history.map((h: any) => h.netMass),
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Masse Totale (Net + Patr.)',
                            data: this.stats.history.map((h: any) => h.totalMass),
                            borderColor: '#1e3a8a',
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        // Répartition par Poste Chart
        if (this.posteChartRef) {
            const ctx = this.posteChartRef.nativeElement.getContext('2d');
            this.posteChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: this.stats.posteDistribution.map((p: any) => p.name),
                    datasets: [{
                        data: this.stats.posteDistribution.map((p: any) => p.value),
                        backgroundColor: [
                            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
        }
    }
}
