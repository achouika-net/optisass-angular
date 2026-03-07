import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButton, MatFabButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { ThemePalette } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { ActionsButton } from '@app/models';
import { DirectionType } from '@app/types';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Filters buttons by direction.
 * @param {ActionsButton[]} buttons - The array of buttons to filter.
 * @param {DirectionTypeValues} direction - The direction to filter buttons by.
 * @returns {ActionsButton[]} - Filtered array of buttons.
 */
const filterByDirection = (buttons: ActionsButton[], direction: DirectionType): ActionsButton[] =>
  buttons.filter((button: ActionsButton) => button.direction === direction);

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

  leftButtons = computed<ActionsButton[]>(() => filterByDirection(this.actionButtons(), 'left'));
  rightButtons = computed<ActionsButton[]>(() => filterByDirection(this.actionButtons(), 'right'));
  // Show the action bar based on the presence of buttons and their display status
  showActionBar = computed<boolean>(
    () =>
      this.actionButtons().length &&
      this.actionButtons().some((button: ActionsButton) => !('display' in button) || button.display)
  );
  isOpen = signal<boolean>(false);
  defaultButtonColor = signal<ThemePalette>('primary').asReadonly();

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
