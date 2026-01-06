import { Component } from '@angular/core';
import { UnderDevelopmentComponent } from '../../shared/components';

@Component({
    selector: 'app-online-payments',
    standalone: true,
    imports: [UnderDevelopmentComponent],
    template: `
    <app-under-development title="Paiements en ligne" icon="credit_card"></app-under-development>
  `
})
export class OnlinePaymentsComponent { }
