import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'applyPromotionToPrice',
})
export class ApplyPromotionToPricePipe implements PipeTransform {
  transform(
    price: number,
    discount: number,
    isPercent: boolean,
    isSelected: boolean
  ): number {
    if (isSelected) {
      return isPercent ? price * (1 - discount / 100) : price - discount;
    }
    return 0;
  }
}
