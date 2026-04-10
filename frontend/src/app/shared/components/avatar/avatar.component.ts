import { Component, input, ChangeDetectionStrategy, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [MatIconModule, NgOptimizedImage],
  templateUrl: './avatar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  imageBase64 = input<string | null>(null);
  size = input<number>(40);

  imageSrc = computed(() => {
    const val = this.imageBase64();
    if (!val) return null;
    
    // If it's already a data URI or an absolute URL, return as is
    if (val.startsWith('data:') || val.startsWith('http') || val.startsWith('/')) {
      return val;
    }
    
    // Assume it's a raw base64 string
    return `data:image/png;base64,${val}`;
  });
}
