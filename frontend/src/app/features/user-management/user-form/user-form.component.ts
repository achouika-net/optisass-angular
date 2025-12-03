import { Component, OnInit } from '@angular/core';
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

import { UserService } from '../services/user.service';
import { User, UserStatus, UserRole, Civilite, CentreRole } from '../../../shared/interfaces/user.interface';

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
        MatRadioModule
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

    // Mock centers (should come from a CentreService in production)
    centres = [
        { id: 'c1', name: 'DOURDAN' },
        { id: 'c2', name: 'ETAMPES' },
        { id: 'c3', name: 'PARIS' },
        { id: 'c4', name: 'LYON' }
    ];

    constructor(
        private fb: FormBuilder,
        private userService: UserService,
        private router: Router,
        private route: ActivatedRoute
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
            agrement: [''], // Optional
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
            role: [centreRole?.role || UserRole.CENTRE, Validators.required]
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
        const centre = this.centres.find(c => c.id === centreId);
        if (centre) {
            this.centreRoles.at(index).patchValue({ centreName: centre.name });
        }
    }

    /**
     * Load user data for editing
     */
    private loadUser(id: string): void {
        this.userService.getUserById(id).subscribe(user => {
            if (user) {
                this.userForm.patchValue({
                    nom: user.nom,
                    prenom: user.prenom,
                    civilite: user.civilite,
                    telephone: user.telephone,
                    email: user.email,
                    photoUrl: user.photoUrl,
                    agrement: user.agrement,
                    statut: user.statut
                });

                // Set photo preview if exists
                if (user.photoUrl) {
                    this.photoPreview = user.photoUrl;
                }

                // Load centre-roles
                user.centreRoles.forEach(cr => {
                    this.centreRoles.push(this.createCentreRoleGroup(cr));
                });
            }
        });
    }

    /**
     * Save user (create or update)
     */
    onSubmit(): void {
        if (this.userForm.valid) {
            const userData = this.userForm.value;

            if (this.isEditMode && this.userId) {
                this.userService.updateUser(this.userId, userData).subscribe(() => {
                    this.router.navigate(['/p/users']);
                });
            } else {
                this.userService.createUser(userData).subscribe(() => {
                    this.router.navigate(['/p/users']);
                });
            }
        }
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
            reader.onload = (e) => {
                this.photoPreview = e.target?.result as string;
                // In production, upload to server and get URL
                // For now, store the base64 preview
                this.userForm.patchValue({ photoUrl: this.photoPreview });
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
                canvas.toBlob((blob) => {
                    if (blob) {
                        // Create preview
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            this.photoPreview = e.target?.result as string;
                            this.userForm.patchValue({ photoUrl: this.photoPreview });
                            this.closeCamera();
                        };
                        reader.readAsDataURL(blob);

                        // Store as file
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
     * Cancel and go back
     */
    onCancel(): void {
        this.closeCamera(); // Stop camera if active
        this.router.navigate(['/p/users']);
    }
}
