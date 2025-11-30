import { inject, Injectable } from '@angular/core';
import { ResourcesService } from '@app/services';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class ResourcesEffects {
  #actions$ = inject(Actions);
  #store = inject(Store);
  #resourcesService = inject(ResourcesService);
  #toastr = inject(ToastrService);
  #translate = inject(TranslateService);
}
