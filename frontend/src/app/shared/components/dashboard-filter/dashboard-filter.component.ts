import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';

export interface DashboardFilterResult {
  startDate: Date;
  endDate: Date;
  period: string;
}

@Component({
  selector: 'app-dashboard-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatChipsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatNativeDateModule
  ],
  template: `
    <div class="dashboard-filter-container">
      <div class="filter-row">
        <mat-chip-listbox [(ngModel)]="selectedPeriod" (change)="onPeriodChange($event.value)" class="period-chips">
          <mat-chip-option value="today">Aujourd'hui</mat-chip-option>
          <mat-chip-option value="week">Cette Semaine</mat-chip-option>
          <mat-chip-option value="month">Ce Mois</mat-chip-option>
          <mat-chip-option value="year">Cette Année</mat-chip-option>
          <mat-chip-option value="custom">Personnalisé</mat-chip-option>
        </mat-chip-listbox>

        <div class="custom-range" *ngIf="selectedPeriod === 'custom'" [formGroup]="rangeForm">
          <mat-form-field appearance="outline" class="dense-field">
            <mat-label>Du</mat-label>
            <input matInput [matDatepicker]="startPicker" formControlName="start" (dateChange)="onDateChange()">
            <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
            <mat-datepicker #startPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline" class="dense-field">
            <mat-label>Au</mat-label>
            <input matInput [matDatepicker]="endPicker" formControlName="end" (dateChange)="onDateChange()">
            <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
            <mat-datepicker #endPicker></mat-datepicker>
          </mat-form-field>
        </div>

        <button mat-icon-button (click)="refresh()" class="refresh-btn" matTooltip="Actualiser">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-filter-container {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      padding: 8px 16px;
      border-radius: 12px;
      border: 1px solid rgba(226, 232, 240, 0.5);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      display: inline-block;
      transition: all 0.3s ease;
    }
    .dashboard-filter-container:hover {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.07);
      border-color: rgba(59, 130, 246, 0.3);
    }
    .filter-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    ::ng-deep .period-chips .mat-mdc-chip-option {
      --mdc-chip-elevated-container-color: #f8fafc;
      --mdc-chip-selected-elevated-container-color: #1e40af;
      --mdc-chip-label-text-color: #64748b;
      --mdc-chip-selected-label-text-color: #ffffff;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !get;
    }
    ::ng-deep .period-chips .mat-mdc-chip-option:hover:not(.mat-mdc-chip-selected) {
      background-color: #f1f5f9 !important;
      transform: translateY(-1px);
    }
    .custom-range {
      display: flex;
      align-items: center;
      gap: 8px;
      animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .dense-field {
      width: 140px;
    }
    ::ng-deep .dense-field .mat-mdc-text-field-wrapper {
      background-color: transparent !important;
      transition: border-color 0.2s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .refresh-btn {
      color: #94a3b8;
      transition: transform 0.4s ease;
    }
    .refresh-btn:hover {
      color: #3b82f6;
      transform: rotate(180deg);
    }
  `]
})
export class DashboardFilterComponent implements OnInit {
  @Input() initialPeriod: string = 'month';
  @Output() filterChanged = new EventEmitter<DashboardFilterResult>();

  selectedPeriod: string = 'month';
  rangeForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.rangeForm = this.fb.group({
      start: [null],
      end: [null]
    });
  }

  ngOnInit(): void {
    this.selectedPeriod = this.initialPeriod;
    if (this.selectedPeriod !== 'custom') {
      this.calculateRangeAndEmit();
    }
  }

  onPeriodChange(period: string): void {
    if (!period) return;
    this.selectedPeriod = period;
    if (period !== 'custom') {
      this.calculateRangeAndEmit();
    }
  }

  onDateChange(): void {
    if (this.rangeForm.valid) {
      const { start, end } = this.rangeForm.value;
      if (start && end) {
        this.filterChanged.emit({
          startDate: start,
          endDate: end,
          period: 'custom'
        });
      }
    }
  }

  refresh(): void {
    if (this.selectedPeriod === 'custom') {
      this.onDateChange();
    } else {
      this.calculateRangeAndEmit();
    }
  }

  private calculateRangeAndEmit(): void {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (this.selectedPeriod) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        break;
    }

    this.filterChanged.emit({
      startDate: start,
      endDate: end,
      period: this.selectedPeriod
    });
  }
}
