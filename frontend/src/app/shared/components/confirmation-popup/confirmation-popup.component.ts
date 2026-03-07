import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { NgOptimizedImage } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { ConfirmData } from '@app/models';

@Component({
  selector: 'app-confirmation-popup',
  templateUrl: './confirmation-popup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButton, NgOptimizedImage],
})
export class ConfirmationPopupComponent {
  data = inject<ConfirmData>(MAT_DIALOG_DATA);
}
