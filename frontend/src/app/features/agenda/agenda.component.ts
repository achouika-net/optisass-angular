import { Component } from '@angular/core';
import { UnderDevelopmentComponent } from '../../shared/components';

@Component({
    selector: 'app-agenda',
    standalone: true,
    imports: [UnderDevelopmentComponent],
    template: `
    <app-under-development title="Agendas" icon="event_note"></app-under-development>
  `
})
export class AgendaComponent { }
