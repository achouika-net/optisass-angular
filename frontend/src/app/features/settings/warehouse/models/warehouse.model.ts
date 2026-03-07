import { IAddress } from '@app/models';

export const WAREHOUSE_TYPES = ['PRINCIPALE', 'SECONDAIRE'] as const;
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number];

export interface IWarehouse {
  id: number;
  name: string;
  capacity: number | null;
  address: IAddress | null;
  type: WarehouseType;
  active: boolean;
}
