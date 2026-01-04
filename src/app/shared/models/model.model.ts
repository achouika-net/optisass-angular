export interface IModel {
  id: string;
  code: string;
  label: string;
  brandId: string | null;
  order: number | null;
  active: boolean;
}
