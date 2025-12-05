import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-optic-client-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
    ],
    templateUrl: './optic-client-form.html',
    styleUrl: './optic-client-form.css'
})
export class OpticClientForm {
    clientForm: FormGroup;

    constructor(private fb: FormBuilder) {
        this.clientForm = this.fb.group({
            nom: [''],
            prenom: [''],
            telephone: [''],
            email: [''],
        });
    }

    onSubmit() {
        console.log('Form submitted:', this.clientForm.value);
    }

    onCancel() {
        this.clientForm.reset();
    }
}
