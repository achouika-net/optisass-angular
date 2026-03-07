import { WarehouseType } from './warehouse.model';

export interface IWarehouseSearch {
  name: string | null;
  type: WarehouseType | null;
}

export class WarehouseSearch implements IWarehouseSearch {
  constructor(
    public name: string | null = null,
    public type: WarehouseType | null = null
  ) {}
}
