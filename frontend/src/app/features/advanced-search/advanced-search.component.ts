import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { UnderDevelopmentComponent } from '../../shared/components';

@Component({
  selector: 'app-advanced-search',
  standalone: true,
  imports: [
    UnderDevelopmentComponent
  ],
  template: `
      <app-under-development title="Recherche Avancée" icon="search"></app-under-development>
    `,
  styles: []
})
export class AdvancedSearchComponent { }
