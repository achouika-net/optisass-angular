import { Pipe, PipeTransform } from '@angular/core';
import { CalculateHTPriceFromTTC } from '@app/helpers';

@Pipe({ name: 'calculateHTPriceFromTTC' })
export class CalculateHTPriceFromTTCPipe implements PipeTransform {
  transform(
    prix_ttc: number,
    taux_tva: number,
    soumis_redevance = false,
    redevance = 0,
    decimals = 2
  ): string {
    if (!!prix_ttc && !!taux_tva) {
      return CalculateHTPriceFromTTC(
        prix_ttc,
        taux_tva,
        soumis_redevance,
        redevance
      ).toFixed(decimals);
    }
    return '';
  }
}
