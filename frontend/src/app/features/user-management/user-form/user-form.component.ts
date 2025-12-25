import { Component, OnInit, computed, inject } from '@angular/core';
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

    // Photo upload
    selectedPhoto: File | null = null;
    photoPreview: string | null = null;
    showCamera = false; // Toggle camera view

    // Enums for dropdowns
    civilites = Object.values(Civilite);
    userRoles = Object.values(UserRole);
    userStatuses = Object.values(UserStatus);

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
        private snackBar: MatSnackBar
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
            nom: ['', Validators.required],
            prenom: ['', Validators.required],
            civilite: [Civilite.MONSIEUR, Validators.required],
            telephone: [''],
            email: ['', [Validators.required, Validators.email]],
            photoUrl: [''], // Photo URL
            matricule: [''], // Formerly Agrement
            statut: [UserStatus.ACTIF, Validators.required],
            centreRoles: this.fb.array([])
        });
    }

    /**
     * Get centreRoles FormArray
     */
    get centreRoles(): FormArray {
        return this.userForm.get('centreRoles') as FormArray;
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
                entrepotIds: [], // Reset warehouses when center changes
                entrepotNames: []
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
                this.userForm.patchValue({
                    nom: user.nom,
                    prenom: user.prenom,
                    civilite: user.civilite,
                    telephone: user.telephone,
                    email: user.email,
                    photoUrl: user.photoUrl,
                    matricule: user.matricule,
                    statut: user.statut
                });

                // Set photo preview if exists
                if (user.photoUrl) {
                    this.photoPreview = user.photoUrl;
                }

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
     * Handle photo file selection
     */
    onPhotoSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];

            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Veuillez sélectionner une image valide');
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('La taille de l\'image ne doit pas dépasser 5MB');
                return;
            }

            this.selectedPhoto = file;

            // Create preview
            const reader = new FileReader();
            reader.onload = async (e) => {
                const originalDataUrl = e.target?.result as string;
                try {
                    // Compress image before storing
                    this.photoPreview = await this.compressImage(originalDataUrl);
                    this.userForm.patchValue({ photoUrl: this.photoPreview });
                } catch (error) {
                    console.error('Compression error:', error);
                    this.photoPreview = originalDataUrl;
                    this.userForm.patchValue({ photoUrl: this.photoPreview });
                }
            };
            reader.readAsDataURL(file);
        }
    }

    /**
     * Remove selected photo
     */
    removePhoto(): void {
        this.selectedPhoto = null;
        this.photoPreview = null;
        this.showCamera = false;
        this.userForm.patchValue({ photoUrl: '' });
    }

    /**
     * Open camera for photo capture
     */
    async openCamera(): Promise<void> {
        this.showCamera = true;

        // Wait for DOM to update
        setTimeout(async () => {
            try {
                const video = document.getElementById('cameraVideo') as HTMLVideoElement;
                if (video) {
                    // Request camera access
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: 'user', // Front camera for selfies
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        }
                    });

                    video.srcObject = stream;
                }
            } catch (error) {
                console.error('Error accessing camera:', error);
                alert('Impossible d\'accéder à la caméra. Veuillez vérifier les permissions.');
                this.showCamera = false;
            }
        }, 100);
    }

    /**
     * Capture photo from camera
     */
    async capturePhoto(): Promise<void> {
        const video = document.getElementById('cameraVideo') as HTMLVideoElement;
        const canvas = document.createElement('canvas');

        if (video && video.videoWidth > 0) {
            // Set canvas dimensions to match video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw current video frame to canvas
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert canvas to blob
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        // Create preview
                        const reader = new FileReader();
                        reader.onload = async (e) => {
                            const originalDataUrl = e.target?.result as string;
                            try {
                                // Compress image
                                this.photoPreview = await this.compressImage(originalDataUrl);
                                this.userForm.patchValue({ photoUrl: this.photoPreview });
                                this.closeCamera();
                            } catch (err) {
                                console.error('Compression error:', err);
                                this.photoPreview = originalDataUrl;
                                this.userForm.patchValue({ photoUrl: this.photoPreview });
                                this.closeCamera();
                            }
                        };
                        reader.readAsDataURL(blob);

                        // Store as file (we could store the compressed blob here too if needed)
                        this.selectedPhoto = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
                    }
                }, 'image/jpeg', 0.9);
            }
        }
    }

    /**
     * Close camera and stop stream
     */
    closeCamera(): void {
        const video = document.getElementById('cameraVideo') as HTMLVideoElement;
        if (video && video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        this.showCamera = false;
    }

    /**
     * Compress an image to a maximum dimension and quality
     */
    private compressImage(dataUrl: string, maxWidth: number = 400, quality: number = 0.7): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
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

    /**
     * Cancel and go back
     */
    onCancel(): void {
        this.closeCamera(); // Stop camera if active
        this.router.navigate(['/p/users']);
    }
}
