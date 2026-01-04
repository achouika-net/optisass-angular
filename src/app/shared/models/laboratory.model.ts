export interface ILaboratory {
  id: string;
  code: string;
  label: string;
  country: string | null;
  order: number | null;
  active: boolean;
}
