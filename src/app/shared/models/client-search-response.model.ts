import { TypeClient } from './type-client.model';

export interface IClientSearchResponse {
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
  access_agenda: boolean;
  last_date_appointment: string;
  client_pro_id?: number;
}
