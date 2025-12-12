import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-facture-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatMenuModule,
        MatDividerModule
    ],
    templateUrl: './facture-list.component.html',
    styleUrls: ['./facture-list.component.scss']
})
export class FactureListComponent implements OnInit {
    @Input() clientId: string | null = null;
    displayedColumns: string[] = ['numero', 'type', 'dateEmission', 'client', 'statut', 'totalTTC', 'actions'];
    dataSource: any[] = []; // Replace with Invoice interface

    constructor(private http: HttpClient) { }

    ngOnInit(): void {
        this.loadFactures();
    }

    loadFactures() {
        // TODO: Implement service call
        // this.factureService.findAll().subscribe(...)

        // Mock data for now
        this.dataSource = [
            {
                id: '1',
                numero: 'FAC-2024-001',
                type: 'FACTURE',
                dateEmission: new Date(),
                client: { nom: 'Dupont', prenom: 'Jean' },
                statut: 'PAYEE',
                totalTTC: 1200.00
            }
        ];
    }

    getStatusColor(statut: string): string {
        switch (statut) {
            case 'PAYEE': return 'primary';
            case 'BROUILLON': return 'warn';
            case 'VALIDEE': return 'accent';
            default: return 'default';
        }
    }
}
