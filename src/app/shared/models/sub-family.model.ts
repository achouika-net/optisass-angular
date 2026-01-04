export interface ISubFamily {
  id: string;
  code: string;
  label: string;
  familyId: string | null;
  order: number | null;
  active: boolean;
}
