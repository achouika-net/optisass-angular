import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { ThemePalette } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { DirectionTypeValues, DirectionType, ActionsButton } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
  selector: 'app-actions-buttons',
  templateUrl: './actions-buttons.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    TranslateModule,
    MatCard,
    MatCardContent,
    MatIcon,
    MatTooltip,
    MatButton,
    MatFabButton,
  ],
})
export class ActionsButtonsComponent {
  actionButtons = input.required<ActionsButton[]>();
  action = output<string>();

  leftButtons = computed<ActionsButton[]>(() =>
    this.filterByDirection(this.actionButtons(), DirectionType.LEFT)
  );
  rightButtons = computed<ActionsButton[]>(() =>
    this.filterByDirection(this.actionButtons(), DirectionType.RIGHT)
  );
  // Show the action bar based on the presence of buttons and their display status
  showActionBar = computed<boolean>(
    () =>
      this.actionButtons().length &&
      this.actionButtons().some(
        (button: ActionsButton) => !('display' in button) || button.display
      )
  );
  isOpen = signal<boolean>(false);
  defaultButtonColor = signal<ThemePalette>('primary').asReadonly();

  /**
   * Filters buttons by direction.
   * @param {ActionsButton[]} buttons - The array of buttons to filter.
   * @param {DirectionTypeValues} direction - The direction to filter buttons by.
   * @returns {ActionsButton[]} - Filtered array of buttons.
   */
  filterByDirection(
    buttons: ActionsButton[],
    direction: DirectionTypeValues
  ): ActionsButton[] {
    return buttons.filter(
      (button: ActionsButton) => button.direction === direction
    );
  }

  /**
   * Toggles the state of the list open/close.
   */
  openCloseListButtons(): void {
    this.isOpen.update((state) => !state);
  }

  /**
   * Emits an action event.
   * @param {string} action - The action to emit.
   */
  emitAction(action: string): void {
    this.action.emit(action);
  }
}
