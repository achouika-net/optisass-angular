import { Routes } from '@angular/router';
import { provideParsers, registerParser } from '@app/core/ocr';
import { SupplierInvoiceParser } from './parsers/supplier-invoice.parser';

export const STOCK_ENTRY_ROUTES: Routes = [
  {
    path: '',
    providers: [
      provideParsers(registerParser('invoice', SupplierInvoiceParser, 'Supplier Invoice Parser')),
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/stock-entry/stock-entry.component').then(
            (m) => m.StockEntryComponent,
          ),
        title: 'stock.entry.title',
      },
    ],
  },
];
