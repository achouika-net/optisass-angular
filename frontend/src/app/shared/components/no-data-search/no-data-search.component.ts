import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-no-data-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, MatCardModule, NgOptimizedImage],
  template: `
    @if (image() || message()) {
      <mat-card [style.box-shadow]="!boxShadow() && 'none !important'">
        <mat-card-content>
          <div class="flex flex-col items-center">
            <img
              [ngSrc]="image()"
              [alt]="message() | translate"
              loading="lazy"
              width="200"
              height="152"
            />
            @if (message()) {
              <p class="font-medium">{{ message() | translate }}</p>
            }
          </div>
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class NoDataSearchComponent {
  message = input<string>('commun.noData');
  image = input<string>('images/no-data-found.png');
  boxShadow = input<boolean>(true);
}
