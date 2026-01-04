export interface IBrand {
  id: string;
  code: string;
  label: string;
  logo: string | null;
  country: string | null;
  order: number | null;
  active: boolean;
}
