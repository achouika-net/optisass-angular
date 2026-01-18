import { Routes } from '@angular/router';
import { provideParsers, registerParser } from '../../../core/ocr';
import { SupplierInvoiceParser } from './parsers/supplier-invoice.parser';

export const ALIMENTATION_ROUTES: Routes = [
  {
    path: '',
    providers: [
      provideParsers(registerParser('invoice', SupplierInvoiceParser, 'Supplier Invoice Parser')),
    ],
    children: [
      {
        path: 'test-ocr',
        loadComponent: () =>
          import('./components/invoice-upload/invoice-upload.component').then(
            (m) => m.InvoiceUploadComponent,
          ),
        title: 'Test OCR Facture',
      },
      {
        path: '',
        redirectTo: 'test-ocr',
        pathMatch: 'full',
      },
    ],
  },
];
