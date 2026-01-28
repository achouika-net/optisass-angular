import { Component, OnInit, computed, inject, ChangeDetectorRef } from '@angular/core';
import { CameraCaptureDialogComponent } from '../../../shared/components/camera-capture/camera-capture-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { toSignal } from '@angular/core/rxjs-interop';

import { UserService } from '../services/user.service';
import { User, UserStatus, UserRole, Civilite, CentreRole } from '../../../shared/interfaces/user.interface';
import { CentersService } from '../../centers/services/centers.service';
import { Centre, Entrepot } from '../../../shared/interfaces/warehouse.interface';
import { PersonnelService } from '../../personnel-management/services/personnel.service';
import { Employee } from '../../../shared/interfaces/employee.interface';

@Component({
    selector: 'app-user-form',
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
        MatRadioModule,
        MatSnackBarModule,
        MatCheckboxModule
    ],
    templateUrl: './user-form.component.html',
    styleUrls: ['./user-form.component.scss']
})
export class UserFormComponent implements OnInit {
    userForm: FormGroup;
    isEditMode = false;
    userId?: string;

    // Personnel
    // Personnel
    private personnelService = inject(PersonnelService);
    allEmployees = toSignal(this.personnelService.getEmployees(), { initialValue: [] as Employee[] });

    // Filter employees: Show all if editing (to include current), otherwise only show those without user
    employees = computed(() => {
        const all = this.allEmployees();
        if (this.isEditMode && this.selectedEmployee) {
            // If editing, we still want to be able to see the current one
            return all.filter(e => !e.userId || e.id === this.selectedEmployee?.id);
        }
        return all.filter(e => !e.userId);
    });

    selectedEmployee: Employee | null = null;

    // Enums for dropdowns
    civilites = Object.values(Civilite);
    userRoles = Object.values(UserRole);
    userStatuses = Object.values(UserStatus);
    hidePassword = true;

    // Real centers from service
    private centersService = inject(CentersService);
    realCentres = toSignal(this.centersService.findAll(), { initialValue: [] as Centre[] });

    // Computed to map backend structure if needed (but currently structures match roughly)
    centres = computed(() => this.realCentres());

    constructor(
        private fb: FormBuilder,
        private userService: UserService,
        private router: Router,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef
    ) {
        this.userForm = this.createForm();
    }

    ngOnInit(): void {
        this.route.params.subscribe(params => {
            if (params['id']) {
                this.isEditMode = true;
                this.userId = params['id'];
                this.loadUser(this.userId);
            } else {
                // Add one empty centre-role by default for new users
                this.addCentreRole();
            }
        });
    }

    /**
     * Create the reactive form
     */
    private createForm(): FormGroup {
        return this.fb.group({
            employeeId: ['', Validators.required],
            // Personal info fields removed as they come from Employee
            // Keeping them as hidden/readonly controls if needed for backend compat? 
            // The backend CreateUserDto still expects nom, prenom, email.
            // So we should keep them in the form but populate them from Employee and maybe disable them or hide them.
            nom: ['', Validators.required],
            prenom: ['', Validators.required],
            civilite: [Civilite.MONSIEUR, Validators.required],
            email: ['', [Validators.required, Validators.email]],
            telephone: [''],
            matricule: [''],
            photoUrl: [''],

            statut: [UserStatus.ACTIF, Validators.required],
            password: [''],
            centreRoles: this.fb.array([])
        });
    }

    /**
     * Get centreRoles FormArray
     */
    get centreRoles(): FormArray {
        return this.userForm.get('centreRoles') as FormArray;
    }

    onEmployeeChange(employeeId: string): void {
        const employee = this.allEmployees().find(e => e.id === employeeId);
        if (employee) {
            this.selectedEmployee = employee;
            // Populate hidden fields required by backend
            this.userForm.patchValue({
                nom: employee.nom,
                prenom: employee.prenom,
                email: employee.email,
                telephone: employee.telephone,
                matricule: employee.matricule,
                photoUrl: employee.photoUrl
                // civilite? Employee doesn't have civilite strictly in interface but User does. Default to Monsieur or infer?
                // Let's leave civilite as manual or default.
            });

            // Auto-generate roles based on employee centers
            this.centreRoles.clear();
            if (employee.centres && employee.centres.length > 0) {
                employee.centres.forEach((c: any) => {
                    // Find the full centre object to get name
                    const fullCentre = this.realCentres().find(rc => rc.id === c.centreId);
                    if (fullCentre) {
                        this.centreRoles.push(this.fb.group({
                            centreId: [fullCentre.id, Validators.required],
                            centreName: [fullCentre.nom],
                            role: [UserRole.VENDEUR, Validators.required], // Default role?
                            entrepotIds: [fullCentre.entrepots.map(e => e.id)],
                            entrepotNames: [fullCentre.entrepots.map(e => e.nom)]
                        }));
                    }
                });
            }
        }
    }

    /**
     * Create a centre-role form group
     */
    private createCentreRoleGroup(centreRole?: CentreRole): FormGroup {
        return this.fb.group({
            id: [centreRole?.id || ''],
            centreId: [centreRole?.centreId || '', Validators.required],
            centreName: [centreRole?.centreName || ''],
            role: [centreRole?.role || UserRole.CENTRE, Validators.required],
            entrepotIds: [centreRole?.entrepotIds || []],
            entrepotNames: [centreRole?.entrepotNames || []]
        });
    }

    /**
     * Add a new centre-role association
     */
    addCentreRole(): void {
        this.centreRoles.push(this.createCentreRoleGroup());
    }

    /**
     * Remove a centre-role association
     */
    removeCentreRole(index: number): void {
        this.centreRoles.removeAt(index);
    }

    /**
     * Update centre name when centre is selected
     */
    onCentreChange(index: number): void {
        const centreId = this.centreRoles.at(index).get('centreId')?.value;
        const centre = this.centres().find(c => c.id === centreId);
        if (centre) {
            this.centreRoles.at(index).patchValue({
                centreName: centre.nom,
                entrepotIds: centre.entrepots.map(e => e.id), // Auto-select all warehouses
                entrepotNames: centre.entrepots.map(e => e.nom)
            });
        }
    }

    /**
     * Update warehouse names when warehouses are selected
     */
    onEntrepotsChange(index: number): void {
        const centreId = this.centreRoles.at(index).get('centreId')?.value;
        const entrepotIds = this.centreRoles.at(index).get('entrepotIds')?.value as string[];
        const centre = this.centres().find(c => c.id === centreId);

        if (centre && entrepotIds) {
            const names = centre.entrepots
                .filter(e => entrepotIds.includes(e.id))
                .map(e => e.nom);

            this.centreRoles.at(index).get('entrepotNames')?.setValue(names);
        }
    }

    /**
     * Get available warehouses for a specific row
     */
    getEntrepotsForCentre(index: number): Entrepot[] {
        const centreId = this.centreRoles.at(index).get('centreId')?.value;
        const centre = this.centres().find(c => c.id === centreId);
        return centre?.entrepots || [];
    }

    /**
     * Load user data for editing
     */
    private loadUser(id: string): void {
        this.userService.getUserById(id).subscribe((user: User | undefined) => {
            if (user) {
                // If editing existing user, we might not have employeeId link in frontend model yet (if not returned by API)
                // But if we do, we set it.
                // NOTE: User Interface needs employeeId field if we want to bind it.

                this.userForm.patchValue({
                    employeeId: user.employee?.id || '',
                    nom: user.nom,
                    prenom: user.prenom,
                    civilite: user.civilite,
                    telephone: user.telephone,
                    email: user.email,
                    photoUrl: user.photoUrl,
                    matricule: user.matricule,
                    statut: user.statut
                });

                if (user.employee) {
                    this.selectedEmployee = user.employee as any;
                }

                // Set photo preview if exists - No longer used as we use selectedEmployee
                // if (user.photoUrl) {
                //    this.photoPreview = user.photoUrl;
                // }

                // Load centre-roles
                user.centreRoles.forEach((cr: CentreRole) => {
                    this.centreRoles.push(this.createCentreRoleGroup(cr));
                });
            }
        });
    }

    /**
     * Toggle status selection (Actif/Inactif)
     */
    toggleStatus(status: string): void {
        this.userForm.get('statut')?.setValue(status);
    }

    /**
     * Check if a status is currently selected
     */
    isStatusSelected(status: string): boolean {
        return this.userForm.get('statut')?.value === status;
    }

    /**
     * Save user (create or update)
     */
    onSubmit(): void {
        if (this.userForm.invalid) {
            this.snackBar.open('Veuillez remplir tous les champs obligatoires', 'Fermer', { duration: 3000 });
            this.userForm.markAllAsTouched();
            return;
        }

        // Clean up data before sending
        const formValue = this.userForm.value;
        const userData = { ...formValue };

        // Process centreRoles to remove empty IDs and ensure names are up to date
        if (userData.centreRoles) {
            userData.centreRoles = userData.centreRoles.map((role: any) => {
                const cleanedRole = { ...role };
                // Remove id if it's empty (for creation)
                if (!cleanedRole.id) {
                    delete cleanedRole.id;
                }
                return cleanedRole;
            });
        }

        const action = this.isEditMode && this.userId
            ? this.userService.updateUser(this.userId, userData)
            : this.userService.createUser(userData);

        action.subscribe({
            next: () => {
                this.snackBar.open('L\'utilisateur a été enregistré avec succès', 'OK', { duration: 3000 });
                this.router.navigate(['/p/users']);
            },
            error: (err) => {
                console.error('Error saving user:', err);
                this.snackBar.open('Une erreur est survenue lors de l\'enregistrement', 'Fermer', { duration: 5000 });
            }
        });
    }

    /**
     * Cancel and go back
     */
    onCancel(): void {
        this.router.navigate(['/p/users']);
    }
}
