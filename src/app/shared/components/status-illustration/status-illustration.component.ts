import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-status-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (status() !== null || status() !== undefined) {
      <mat-icon [class]="statusColor()">
        {{ status() ? 'check_circle' : 'cancel' }}
      </mat-icon>
    }
  `,
})
export class StatusIllustrationComponent {
  status = input.required<boolean>();
  statusColor = computed<string>(() =>
    this.status() ? 'text-success' : 'text-error'
  );
}
