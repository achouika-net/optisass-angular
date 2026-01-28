import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CameraCaptureDialogComponent } from '../../../shared/components/camera-capture/camera-capture-dialog.component';
import { MatDialog } from '@angular/material/dialog';
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

    // Photo
    selectedPhoto: File | null = null;
    photoPreview: string | null = null;

    postes = ['OPTICIEN', 'VENDEUR', 'CAISSIER', 'RESPONSABLE', 'ADMIN', 'STAGIAIRE'];
    contrats = ['CDI', 'CDD', 'JOURNALIER', 'PARTIEL', 'STAGE'];
    statuts = ['ACTIF', 'SUSPENDU', 'SORTI'];

    constructor(
        private fb: FormBuilder,
        private personnelService: PersonnelService,
        private router: Router,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef
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
            centreIds: [[], Validators.required],
            photoUrl: [''],
            childrenCount: [0, [Validators.min(0)]],
            familyStatus: ['CELIBATAIRE', Validators.required],
            socialSecurityAffiliation: [true],
            paymentMode: ['VIREMENT']
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
                centreIds: employee.centres?.map((c: any) => c.centreId) || [],
                photoUrl: employee.photoUrl,
                childrenCount: employee.childrenCount,
                familyStatus: employee.familyStatus || 'CELIBATAIRE',
                socialSecurityAffiliation: employee.socialSecurityAffiliation,
                paymentMode: employee.paymentMode
            });
            if (employee.photoUrl) {
                this.photoPreview = employee.photoUrl;
            }
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
            childrenCount: parseInt(formValue.childrenCount) || 0,
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
    onPhotoSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (!file.type.startsWith('image/')) {
                alert('Veuillez sélectionner une image valide');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert('La taille de l\'image ne doit pas dépasser 5MB');
                return;
            }
            this.selectedPhoto = file;
            const reader = new FileReader();
            reader.onload = async (e) => {
                const originalDataUrl = e.target?.result as string;
                try {
                    this.photoPreview = await this.compressImage(originalDataUrl);
                    this.employeeForm.patchValue({ photoUrl: this.photoPreview });
                } catch (error) {
                    console.error('Compression error:', error);
                    this.photoPreview = originalDataUrl;
                    this.employeeForm.patchValue({ photoUrl: this.photoPreview });
                }
            };
            reader.readAsDataURL(file);
        }
    }

    removePhoto(): void {
        this.selectedPhoto = null;
        this.photoPreview = null;
        this.employeeForm.patchValue({ photoUrl: '' });
    }

    async openCamera(): Promise<void> {
        const dialogRef = this.dialog.open(CameraCaptureDialogComponent, {
            width: '800px',
            disableClose: true
        });

        dialogRef.afterClosed().subscribe(dataUrl => {
            if (dataUrl) {
                this.handleCapturedPhoto(dataUrl);
            }
        });
    }

    private async handleCapturedPhoto(dataUrl: string): Promise<void> {
        try {
            this.photoPreview = await this.compressImage(dataUrl);
            this.employeeForm.patchValue({ photoUrl: this.photoPreview });
            this.selectedPhoto = this.dataURLtoFile(this.photoPreview, 'camera-photo.jpg');
            this.cdr.markForCheck();
        } catch (err) {
            console.error('Photo handling error:', err);
            this.photoPreview = dataUrl;
            this.employeeForm.patchValue({ photoUrl: this.photoPreview });
            this.selectedPhoto = this.dataURLtoFile(dataUrl, 'camera-photo.jpg');
            this.cdr.markForCheck();
        }
    }

    private dataURLtoFile(dataurl: string, filename: string): File {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    }

    private compressImage(dataUrl: string, maxWidth: number = 400, quality: number = 0.7): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxWidth) {
                        width *= maxWidth / height;
                        height = maxWidth;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.onerror = (e) => reject(e);
            img.src = dataUrl;
        });
    }
}
