import { ILinks, IMeta, Links, Meta } from '@app/models';
export interface IPaginatedApiResponse<T> {
  data: T[];
  links: ILinks;
  meta: IMeta;
}
export class PaginatedApiResponse<T> implements IPaginatedApiResponse<T> {
  data: T[];
  links: ILinks;
  meta: IMeta;

  constructor(data?: T[]) {
    this.data = data || null;
    this.links = new Links();
    this.meta = new Meta(data?.length);
  }
}
