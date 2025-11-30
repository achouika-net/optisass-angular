import { Pipe, PipeTransform, Signal } from '@angular/core';

@Pipe({ name: 'getElementFromResource' })
export class GetElementFromResourcePipe implements PipeTransform {
  /**
   * get a row from selector
   * Takes selector, value and key that defaults to id
   * Usage:
   *   selector | getElementFromResource: element.mode_reglement_id
   *   OR
   *   selector | getElementFromResource: element.code_regelement : 'code'
   * Example:
   *  {{ modesReglementsSelector| getElementFromResource : element.type_reglement }}
   * @param resource
   * @param value string | number | number[]
   * @param key string
   */
  transform<T, K extends keyof T>(
    resource: Signal<T[]>,
    value: T[K] | T[K][],
    key: K = 'id' as K
  ): T[] | T {
    const data = resource();
    if (!data.length) return;
    if (Array.isArray(value)) {
      // Handle the case when 'value' is an array
      return data.filter((row: T) => value.includes(row[key]));
    } else {
      // Handle the case when 'value' is a single string or number
      return data.find((row: T) => row[key] === value);
    }
  }
}
