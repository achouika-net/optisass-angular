import { createEmptyAddress, IAddress } from './address.model';

export interface ISupplier {
  id: string | null;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: IAddress;
  contactName: string | null;
  website: string | null;
  ice: string | null;
  tradeRegister: string | null;
  taxId: string | null;
  businessLicense: string | null;
  siret: string | null;
  bank: string | null;
  bankAccountNumber: string | null;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ISupplierSearchRequest {
  query: string | null;
  active: boolean | null;
}

export type SupplierCreateRequest = Omit<ISupplier, 'id' | 'createdAt' | 'updatedAt'>;
export type SupplierUpdateRequest = Partial<SupplierCreateRequest>;

/**
 * Creates an empty supplier for new supplier creation.
 * @returns A new empty supplier with id: null
 */
export function createEmptySupplier(): ISupplier {
  return {
    id: null,
    code: '',
    name: '',
    email: null,
    phone: null,
    address: { ...createEmptyAddress(), country: 'Maroc' },
    contactName: null,
    website: null,
    ice: null,
    tradeRegister: null,
    taxId: null,
    businessLicense: null,
    siret: null,
    bank: null,
    bankAccountNumber: null,
    active: true,
    createdAt: null,
    updatedAt: null,
  };
}
