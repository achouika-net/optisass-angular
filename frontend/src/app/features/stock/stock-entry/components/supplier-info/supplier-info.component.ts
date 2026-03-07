import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AddressFieldsComponent } from '@app/components';
import { FieldControlLabelDirective } from '@app/directives';
import { ISupplier } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-supplier-info',
  templateUrl: './supplier-info.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddressFieldsComponent,
    FieldControlLabelDirective,
    FormField,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
  ],
})
export class SupplierInfoComponent {
  readonly supplierField = input.required<FieldTree<ISupplier>>();
}
