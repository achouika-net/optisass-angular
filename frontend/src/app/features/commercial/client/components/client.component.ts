import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ClientService } from '@app/services';
import { ClientStore } from '../client.store';

@Component({
  selector: 'app-client',
  imports: [RouterOutlet],
  template: ` <router-outlet /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ClientService, ClientStore],
})
export default class ClientComponent {}
