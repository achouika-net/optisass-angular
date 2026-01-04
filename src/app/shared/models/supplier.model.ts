export interface ISupplier {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contactName: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface ISupplierSearchRequest {
  query: string | null;
  active: boolean | null;
}

export type SupplierCreateRequest = Omit<ISupplier, 'id' | 'createdAt' | 'updatedAt'>;
export type SupplierUpdateRequest = Partial<SupplierCreateRequest>;
