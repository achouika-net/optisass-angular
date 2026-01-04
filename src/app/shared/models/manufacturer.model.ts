export interface IManufacturer {
  id: string;
  code: string;
  label: string;
  country: string | null;
  contact: string | null;
  order: number | null;
  active: boolean;
}
