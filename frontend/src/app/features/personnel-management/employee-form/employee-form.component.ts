import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatListModule } from '@angular/material/list';
import { toSignal } from '@angular/core/rxjs-interop';

import { PersonnelService } from '../services/personnel.service';
import { CentersService } from '../../centers/services/centers.service';
import { Centre } from '../../../shared/interfaces/warehouse.interface';
import { Employee } from '../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-employee-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatSnackBarModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatListModule
    ],
    templateUrl: './employee-form.component.html',
    styleUrls: ['./employee-form.component.scss']
})
export class EmployeeFormComponent implements OnInit {
    employeeForm: FormGroup;
    isEditMode = false;
    employeeId?: string;

    private centersService = inject(CentersService);
    centers = toSignal(this.centersService.findAll(), { initialValue: [] as Centre[] });

    postes = ['OPTICIEN', 'VENDEUR', 'CAISSIER', 'RESPONSABLE', 'ADMIN', 'STAGIAIRE'];
    contrats = ['CDI', 'CDD', 'JOURNALIER', 'PARTIEL', 'STAGE'];
    statuts = ['ACTIF', 'SUSPENDU', 'SORTI'];

    constructor(
        private fb: FormBuilder,
        private personnelService: PersonnelService,
        private router: Router,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar
    ) {
        this.employeeForm = this.fb.group({
            matricule: [''],
            nom: ['', Validators.required],
            prenom: ['', Validators.required],
            cin: [''],
            telephone: [''],
            email: ['', [Validators.email]],
            adresse: [''],
            poste: ['VENDEUR', Validators.required],
            contrat: ['CDI', Validators.required],
            dateEmbauche: [new Date()],
            salaireBase: [0, [Validators.required, Validators.min(0)]],
            statut: ['ACTIF', Validators.required],
            centreIds: [[], Validators.required]
        });
    }

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            if (params['id']) {
                this.isEditMode = true;
                this.employeeId = params['id'];
                this.loadEmployee(this.employeeId);
            }
        });
    }

    loadEmployee(id: string): void {
        this.personnelService.getEmployee(id).subscribe(employee => {
            this.employeeForm.patchValue({
                ...employee,
                dateEmbauche: employee.dateEmbauche ? new Date(employee.dateEmbauche) : null,
                centreIds: employee.centres?.map((c: any) => c.centreId) || []
            });
        });
    }

    onSubmit(): void {
        if (this.employeeForm.invalid) {
            this.snackBar.open('Veuillez remplir les champs obligatoires', 'Fermer', { duration: 3000 });
            return;
        }

        const formValue = this.employeeForm.value;

        // Transform data to match backend DTO expectations
        const data = {
            ...formValue,
            salaireBase: parseFloat(formValue.salaireBase) || 0,
            dateEmbauche: formValue.dateEmbauche ? new Date(formValue.dateEmbauche).toISOString() : new Date().toISOString()
        };

        console.log('Sending employee data:', data);

        const action = this.isEditMode ?
            this.personnelService.updateEmployee(this.employeeId!, data) :
            this.personnelService.createEmployee(data);

        action.subscribe({
            next: () => {
                this.snackBar.open('Employé enregistré avec succès', 'OK', { duration: 3000 });
                this.router.navigate(['/p/personnel/employees']);
            },
            error: (err) => {
                console.error('Error details:', err);
                const errorMessage = err?.error?.message || err?.message || 'Erreur lors de l\'enregistrement';
                this.snackBar.open(errorMessage, 'Fermer', { duration: 5000 });
            }
        });
    }
}
