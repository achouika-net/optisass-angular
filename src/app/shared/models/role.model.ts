export interface IRole {
  id: number;
  name: string;
  is_reference: boolean;
  groupe_id?: number;
  parent_id?: number;
}
