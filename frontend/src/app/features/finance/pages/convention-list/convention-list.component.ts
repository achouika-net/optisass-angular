import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';

import { FinanceService } from '../../services/finance.service';
import { Convention } from '../../models/finance.models';
import { ConventionFormDialogComponent } from '../../components/convention-form-dialog/convention-form-dialog.component';

@Component({
  selector: 'app-convention-list',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  templateUrl: './convention-list.component.html',
  styles: [`
    .container-fluid { 
      max-width: 98%;
      margin: 0 auto;
      padding: 20px 0;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      margin-bottom: 24px;
    }
    mat-card {
      width: 100%;
      overflow: hidden;
    }
    table { 
      width: 100%; 
    }
    .remise-chip {
        font-weight: bold;
    }
  `]
})
export class ConventionListComponent implements OnInit {
  conventions: Convention[] = [];
  displayedColumns: string[] = ['nom', 'remise', 'contact', 'telephone', 'clientsCount', 'actions'];
  loading = false;

  constructor(
    private financeService: FinanceService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadConventions();
  }

  loadConventions() {
    this.loading = true;
    this.financeService.getConventions().subscribe({
      next: (data) => {
        this.conventions = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur chargement conventions', err);
        this.snackBar.open('Erreur lors du chargement des conventions', 'Fermer', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  openConventionDialog(convention?: Convention) {
    const dialogRef = this.dialog.open(ConventionFormDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      data: { convention }
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('Dialog closed with result:', result);
      if (result) {
        // Optimistic update for immediate feedback
        if (!convention) {
          // New convention (prepend to match backend sorting)
          this.conventions = [result, ...this.conventions];
        } else {
          // Update existing
          this.conventions = this.conventions.map(c => c.id === result.id ? result : c);
        }
        this.cdr.detectChanges();

        // Refresh in background to get counts and confirm state
        setTimeout(() => {
          this.loadConventions();
          this.snackBar.open(
            convention ? 'Convention mise à jour' : 'Convention créée avec succès', 
            'OK', 
            { duration: 3000 }
          );
        }, 500);
      }
    });
  }

  deleteConvention(convention: Convention) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer la convention "${convention.nom}" ?`)) {
      this.financeService.deleteConvention(convention.id).subscribe({
        next: () => {
          this.snackBar.open('Convention supprimée', 'OK', { duration: 3000 });
          this.loadConventions();
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  getRemiseLabel(convention: Convention): string {
    if (convention.remiseType === 'PERCENTAGE') {
        return `${convention.remiseValeur}%`;
    } else {
        return `${convention.remiseValeur} DH`;
    }
  }
}
