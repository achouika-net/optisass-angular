import { TypeClient, TypesClient } from './index';

export interface IClientSearchRequest {
  type: TypeClient;
  name: string;
  city: string;
  zipcode: string;
  email: string;
  mobile: string;
  access_agenda: boolean | null;
}
export class ClientSearchRequest implements IClientSearchRequest {
  type: TypeClient;
  name: string;
  city: string;
  zipcode: string;
  email: string;
  mobile: string;
  access_agenda: boolean | null;

  constructor() {
    this.type = TypesClient.ALL;
    this.name = '';
    this.city = '';
    this.zipcode = '';
    this.email = '';
    this.mobile = '';
    this.access_agenda = null;
  }
}
