import {
  RouterStateSnapshot,
  ActivatedRouteSnapshot,
  Params,
  Data,
} from '@angular/router';
import { RouterStateSerializer } from '@ngrx/router-store';

export interface CustomRouterState {
  url: string;
  params: Record<string, string>;
  queryParams: Params;
  data: Data;
}

export class CustomRouterSerializer
  implements RouterStateSerializer<CustomRouterState>
{
  serialize(routerState: RouterStateSnapshot): CustomRouterState {
    let route: ActivatedRouteSnapshot = routerState.root;

    // 🔹 Descendre jusqu'à la route active (dernière route imbriquée)
    while (route.firstChild) {
      route = route.firstChild;
    }

    return {
      url: routerState.url,
      params: route.params,
      queryParams: routerState.root.queryParams,
      data: route.data,
    };
  }
}
