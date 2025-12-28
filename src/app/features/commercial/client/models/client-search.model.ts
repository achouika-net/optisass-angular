export interface IClientSearch {
  clientTypeId: number;
  active: number;
  lastName: string;
  firstName: string;
  phone: string;
  idDocument: string;
  familyGroup: string;
  isExport?: boolean;
}

export class ClientSearch implements IClientSearch {
  constructor(
    public clientTypeId: number = -1,
    public active: number = -1,
    public lastName: string = null,
    public firstName: string = null,
    public phone: string = null,
    public idDocument: string = null,
    public familyGroup: string = null
  ) {}
}
