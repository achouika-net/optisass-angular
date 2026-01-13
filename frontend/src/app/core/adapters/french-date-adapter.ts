import { NativeDateAdapter } from '@angular/material/core';
import { Injectable } from '@angular/core';

@Injectable()
export class FrenchDateAdapter extends NativeDateAdapter {
    override parse(value: any): Date | null {
        if (typeof value === 'string') {
            // Try to parse DD/MM/YYYY format
            const parts = value.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
                const year = parseInt(parts[2], 10);

                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    return new Date(year, month, day);
                }
            }
        }
        return super.parse(value);
    }

    override format(date: Date, displayFormat: Object): string {
        if (displayFormat === 'input') {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
        return super.format(date, displayFormat);
    }

    override getFirstDayOfWeek(): number {
        return 1; // Monday (0 = Sunday, 1 = Monday)
    }
}
