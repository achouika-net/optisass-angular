import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface OrderActionData {
  bcNumber: string;
  ficheId: string;
  clientName: string;
  supplierName: string;
}

@Component({
  selector: 'app-order-action-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './order-action-dialog.component.html',
  styleUrls: ['./order-action-dialog.component.css']
})
export class OrderActionDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<OrderActionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OrderActionData
  ) {}

  onAction(action: 'print' | 'email' | 'whatsapp'): void {
    this.dialogRef.close(action);
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
