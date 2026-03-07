import {
  afterNextRender,
  afterRenderEffect,
  Directive,
  ElementRef,
  inject,
  input,
  Renderer2,
} from '@angular/core';
import {
  BreakpointObserver,
  Breakpoints,
  BreakpointState,
} from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
@Directive({ selector: '[appResponsiveTable]' })
export class ResponsiveTableDirective {
  readonly #elementRef = inject(ElementRef);
  readonly #renderer = inject(Renderer2);
  readonly #breakpointObserver = inject(BreakpointObserver);
  appResponsiveTable = input<unknown[]>();
  breakpoint = toSignal<BreakpointState>(
    this.#breakpointObserver.observe([Breakpoints.Small])
  );

  constructor() {
    afterNextRender(() => {
      const tableElement = this.#elementRef.nativeElement;

      if (!tableElement) return;
      // Add the `responsive-table` class
      this.#renderer.addClass(tableElement, 'responsive-table');
      if (!this.breakpoint().matches) {
        this.#processTableRows(tableElement);
      }
    });
    afterRenderEffect(() => {
      const data = this.appResponsiveTable();
      const breakpoint = this.breakpoint();
      const tableElement = this.#elementRef.nativeElement;
      if (!(tableElement && data && breakpoint.matches)) return;
      this.#processTableRows(tableElement);
    });
  }
  #processTableRows(tableElement: HTMLElement): void {
    // Cache header cells
    const headerCells = Array.from(
      tableElement.querySelectorAll('[mat-header-cell]')
    );
    if (!headerCells.length) return;
    // Cache all mat-cell elements
    const matCells = Array.from(tableElement.querySelectorAll('[mat-cell]'));
    // Process each header cell
    headerCells.forEach((headerCell, headerIndex) => {
      const headerContent = headerCell.textContent?.trim();
      if (!headerContent) return;
      // Process cells corresponding to the current header
      matCells
        .filter(
          (_, cellIndex) => cellIndex % headerCells.length === headerIndex
        )
        .forEach((cell) =>
          this.#addResponsiveContent(cell as HTMLElement, headerContent)
        );
    });
  }
  #addResponsiveContent(cell: HTMLElement, headerContent: string): void {
    // Avoid duplicate processing
    if (cell.querySelector('.header-label')) return;
    // Wrap existing content in a div with class `cell-content`
    const cellContentWrapper = this.#renderer.createElement('div');
    this.#renderer.addClass(cellContentWrapper, 'cell-content');
    while (cell.firstChild) {
      this.#renderer.appendChild(cellContentWrapper, cell.firstChild);
    }
    this.#renderer.appendChild(cell, cellContentWrapper);
    // Create and prepend the `.header-label` element
    const headerLabel = this.#renderer.createElement('div');
    this.#renderer.addClass(headerLabel, 'header-label');
    this.#renderer.setProperty(headerLabel, 'textContent', headerContent);
    this.#renderer.insertBefore(cell, headerLabel, cellContentWrapper);
  }
}
