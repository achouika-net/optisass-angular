import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './avatar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  imageBase64 = input<string | null>(null);
  size = input<number>(40);
}
