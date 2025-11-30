import { DEFAULT_PAGE_SIZE } from '@app/config';

export interface IMeta {
  current_page: number;
  from: number;
  last_page: number;
  path: string;
  per_page: number;
  to: number;
  total: number;
}

export class Meta implements IMeta {
  current_page: number;
  from: number;
  last_page: number;
  path: string;
  per_page: number;
  to: number;
  total: number;

  constructor(total: number, per_page?: number) {
    this.current_page = 1;
    this.from = 0;
    this.last_page = 1;
    this.path = null;
    this.per_page = per_page || DEFAULT_PAGE_SIZE;
    this.to = 0;
    this.total = total;
  }
}
