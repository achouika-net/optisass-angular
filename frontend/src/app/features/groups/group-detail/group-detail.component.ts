import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { GroupsService } from '../services/groups.service';
import { Groupe } from '../../../shared/interfaces/warehouse.interface';
import { CenterFormDialogComponent } from '../../centers/center-form-dialog/center-form-dialog.component';

@Component({
    selector: 'app-group-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatDialogModule,
    ],
    templateUrl: './group-detail.component.html',
    styleUrls: ['./group-detail.component.scss']
})
export class GroupDetailComponent implements OnInit {
    groupe: Groupe | null = null;
    loading = false;
    displayedColumns: string[] = ['nom', 'ville', 'telephone', 'entrepots', 'actions'];

    constructor(
        private route: ActivatedRoute,
        private groupsService: GroupsService,
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadGroupe(id);
        }
    }

    loadGroupe(id: string): void {
        this.loading = true;
        this.groupsService.findOne(id).subscribe({
            next: (data) => {
                this.groupe = data;
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading group:', err);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    openCreateCenterDialog(): void {
        if (!this.groupe?.id) return;

        const dialogRef = this.dialog.open(CenterFormDialogComponent, {
            width: '90vw',
            maxWidth: '1000px',
            data: { centre: null, groupeId: this.groupe.id }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && this.groupe?.id) {
                this.loadGroupe(this.groupe.id);
            }
        });
    }

    openEditCenterDialog(centre: any): void {
        const dialogRef = this.dialog.open(CenterFormDialogComponent, {
            width: '90vw',
            maxWidth: '1000px',
            data: { centre: centre, groupeId: this.groupe?.id }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && this.groupe?.id) {
                this.loadGroupe(this.groupe.id);
            }
        });
    }

    getEntrepotsCount(centre: any): number {
        return centre.entrepots?.length || 0;
    }
}
