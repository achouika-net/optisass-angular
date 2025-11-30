import { TypeClient, TypesClient } from './type-client.model';
export interface IClient {
  id: number;
  type: TypeClient;
  civility: string;
  first_name: string;
  last_name: string;
  address: string;
  suite: string;
  zipcode: string;
  city: string;
  phone_code: string;
  phone: string;
  mobile: string;
  email: string;
  campaign_sms: boolean;
  campaign_mail: boolean;
  confirmation_sms: boolean;
  confirmation_mail: boolean;
  reminder_sms: boolean;
  reminder_mail: boolean;
  comment: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  client_pro: Partial<IClientPro>;
  extra_fields: IExtraField[];
}
export class Client implements IClient {
  id: number;
  type: TypeClient;
  civility: string;
  first_name: string;
  last_name: string;
  address: string;
  suite: string;
  zipcode: string;
  city: string;
  phone_code: string;
  phone: string;
  mobile: string;
  email: string;
  campaign_sms: boolean;
  campaign_mail: boolean;
  confirmation_sms: boolean;
  confirmation_mail: boolean;
  reminder_sms: boolean;
  reminder_mail: boolean;
  comment: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  client_pro: Partial<IClientPro>;
  extra_fields: IExtraField[];
  constructor() {
    this.id = null;
    this.type = TypesClient.PASSAGE; // Default type
    this.civility = '';
    this.first_name = '';
    this.last_name = '';
    this.address = '';
    this.suite = '';
    this.zipcode = '';
    this.city = '';
    this.phone_code = '';
    this.phone = '';
    this.mobile = '';
    this.email = '';
    this.campaign_sms = false;
    this.campaign_mail = false;
    this.confirmation_sms = false;
    this.confirmation_mail = false;
    this.reminder_sms = false;
    this.reminder_mail = false;
    this.comment = '';
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
    this.deleted_at = null;
    this.client_pro = {};
    this.extra_fields = [];
  }
}

export interface IClientPro {
  id: number;
  client_id: number;
  display_price: boolean;
  access_agenda: boolean;
  created_at: string;
  updated_at: string;
  new_password: true;
}

export interface IExtraField {
  field_id: number;
  value: string | number | boolean | Date;
}
