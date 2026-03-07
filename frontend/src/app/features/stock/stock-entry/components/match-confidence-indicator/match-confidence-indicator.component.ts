import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { IProductMatchResult, IProductSuggestion, MatchConfidence } from '@app/models';

@Component({
  selector: 'app-match-confidence-indicator',
  templateUrl: './match-confidence-indicator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TranslateModule,
  ],
})
export class MatchConfidenceIndicatorComponent {
  readonly matchResult = input.required<IProductMatchResult | null>();

  readonly suggestionSelect = output<string>();
  readonly clearMatch = output<void>();
  readonly retryMatch = output<void>();

  readonly hasMatch = computed(() => {
    const result = this.matchResult();
    return result?.matchedProductId !== null;
  });

  readonly hasSuggestions = computed(() => {
    const result = this.matchResult();
    return (result?.suggestions.length ?? 0) > 0;
  });

  readonly confidence = computed(() => this.matchResult()?.confidence ?? 'none');

  readonly score = computed(() => this.matchResult()?.score ?? 0);

  readonly method = computed(() => this.matchResult()?.method ?? null);

  readonly suggestions = computed(() => this.matchResult()?.suggestions ?? []);

  readonly iconName = computed(() => {
    const conf = this.confidence();
    return this.#getIconForConfidence(conf);
  });

  readonly chipClass = computed(() => `confidence-chip confidence-${this.confidence()}`);

  readonly tooltipText = computed(() => {
    const result = this.matchResult();
    if (!result) return '';
    return `${result.score}%`;
  });

  /**
   * Handles suggestion selection.
   * @param suggestion The selected suggestion
   */
  onSuggestionSelect(suggestion: IProductSuggestion): void {
    this.suggestionSelect.emit(suggestion.productId);
  }

  /**
   * Handles clear match action.
   */
  onClearMatch(): void {
    this.clearMatch.emit();
  }

  /**
   * Handles retry match action.
   */
  onRetryMatch(): void {
    this.retryMatch.emit();
  }

  /**
   * Returns icon name for confidence level.
   * @param confidence Confidence level
   * @returns Material icon name
   */
  #getIconForConfidence(confidence: MatchConfidence): string {
    switch (confidence) {
      case 'high':
        return 'verified';
      case 'medium':
        return 'help_outline';
      case 'low':
        return 'warning';
      case 'none':
      default:
        return 'search_off';
    }
  }
}
