import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { PersonnelService } from '../services/personnel.service';
import { Employee, Payroll } from '../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-hr-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule
    ],
    templateUrl: './hr-dashboard.component.html',
    styleUrls: ['./hr-dashboard.component.scss']
})
export class HRDashboardComponent implements OnInit {
    totalEmployees = 0;
    activeEmployees = 0;
    monthlySalaryMass = 0;
    totalCommissions = 0;

    constructor(private personnelService: PersonnelService) { }

    ngOnInit(): void {
        this.loadStats();
    }

    loadStats(): void {
        this.personnelService.getEmployees().subscribe(employees => {
            this.totalEmployees = employees.length;
            this.activeEmployees = employees.filter(e => e.statut === 'ACTIF').length;
        });

        const now = new Date();
        const mois = now.toISOString().substring(5, 7);
        const annee = now.getFullYear();

        this.personnelService.getPayrolls(mois, annee).subscribe(payrolls => {
            this.monthlySalaryMass = payrolls.reduce((sum, p) => sum + p.netAPayer, 0);
            this.totalCommissions = payrolls.reduce((sum, p) => sum + p.commissions, 0);
        });
    }
}
