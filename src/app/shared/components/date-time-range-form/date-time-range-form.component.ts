import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { FieldControlLabelDirective } from '@app/directives';
import { TranslatePipe } from '@ngx-translate/core';
import { isSameDay, set } from 'date-fns';
import { FormControlErrorComponent } from '../form-control-error/form-control-error.component';

@Component({
  selector: 'app-date-time-range-form',
  templateUrl: './date-time-range-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    MatExpansionModule,
    MatSlideToggleModule,
    MatInputModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatTimepickerModule,
    FieldControlLabelDirective,
    FormControlErrorComponent,
    FormsModule,
  ],
})
export class DateTimeRangeFormComponent {
  // Accept form controls as inputs
  startDateControl = input.required<FormControl<Date | string>>();
  endDateControl = input.required<FormControl<Date | string>>();

  // Links day signal to start date for the date picker
  day = linkedSignal(() => this.startDateControl().value);

  /**
   * This logic ensures that the dates remain consistent with the user's day selection,
   * updating start and end dates with the selected day. When the day changes, the date part
   * of the start and end dates are updated while preserving their time components.
   * If no day is selected, the date fields are reset.
   * The effect avoids unnecessary updates if the selected day matches the current start date.
   */
  constructor() {
    effect(() => {
      const day = this.day() as Date;
      untracked(() => {
        // Reset date fields if no day selected
        if (!day) {
          this.startDateControl().reset();
          this.endDateControl().reset();
          return;
        }

        const currentStart = this.startDateControl().value;
        const currentEnd = this.endDateControl().value;

        // Convert string dates to Date objects if needed
        const startDate =
          typeof currentStart === 'string'
            ? new Date(currentStart)
            : currentStart;
        const endDate =
          typeof currentEnd === 'string' ? new Date(currentEnd) : currentEnd;

        if (!startDate) return;

        // Do nothing if the selected day is already the same as the current start date
        if (isSameDay(day, startDate)) return;

        const newStart = set(startDate, {
          year: day.getFullYear(),
          month: day.getMonth(),
          date: day.getDate(),
        });

        const newEnd = endDate
          ? set(endDate, {
              year: day.getFullYear(),
              month: day.getMonth(),
              date: day.getDate(),
            })
          : null;

        this.startDateControl().setValue(newStart);
        this.startDateControl().markAsDirty();

        if (newEnd) {
          this.endDateControl().setValue(newEnd);
          this.endDateControl().markAsDirty();
        }
      });
    });
  }
}
