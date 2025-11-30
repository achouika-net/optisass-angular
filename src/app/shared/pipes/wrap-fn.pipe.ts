import { Pipe, PipeTransform } from '@angular/core';

/**
 * Wraps a function and exposes it as a pipe in templates for better performance.
 *
 * @usageNotes
 * Use this pipe to directly invoke functions in Angular templates by using the pipe syntax.
 * The wrapped function and its arguments are specified in the template.
 *
 * @example
 * ```html
 * <!-- Calling a function with no arguments -->
 * {{ someFunction | wrapFn }}
 *
 * <!-- Calling a function with one argument -->
 * {{ someFunction | wrapFn: arg1 }}
 *
 * <!-- Calling a function with multiple arguments -->
 * {{ someFunction | wrapFn: arg1: arg2: arg3 }}
 *
 * ```
 */
@Pipe({ name: 'wrapFn' })
export class WrapFnPipe implements PipeTransform {
  /**
   * Transforms the wrapped function with the specified arguments.
   *
   * @param func - The function to be wrapped and executed.
   * @param args - The arguments to be passed to the wrapped function.
   * @returns The result of executing the wrapped function with the provided arguments.
   * @template ARGS - The types of the arguments for the wrapped function.
   * @template R - The return type of the wrapped function.
   */
  transform<ARGS extends unknown[], R>(
    func: (...args: ARGS) => R,
    ...args: ARGS
  ): R {
    return func(...args);
  }
}
