import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  Signal,
} from '@angular/core';
import { MatCard, MatCardContent } from '@angular/material/card';
import { NgOptimizedImage } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { BackgroundsSelector } from '../../../core/store/settings/settings.selectors';
import { BACKGROUND_IMAGE_REFRESH } from '@app/config';
import { AuthenticationStore } from '../authentication.store';

@Component({
  selector: 'app-authentication',
  templateUrl: './authentication.component.html',
  imports: [MatCard, MatCardContent, NgOptimizedImage, RouterOutlet],
  providers: [AuthenticationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticationComponent {
  readonly #store = inject(Store);
  protected readonly logoPath = signal<string>('/logos/optisaas-logo.png');
  #backgroundTimer: Signal<number> = toSignal(timer(0, BACKGROUND_IMAGE_REFRESH), {
    initialValue: 0,
  });
  /**
   * Signal represents a slideshow of backgrounds returning current background URL.
   */
  protected currentBackground: Signal<string> = computed(() => {
    const backgrounds = this.#store.selectSignal<string[]>(BackgroundsSelector);
    const current = this.#backgroundTimer() % backgrounds().length;
    return `url(${backgrounds()[current]})`;
  });
}
