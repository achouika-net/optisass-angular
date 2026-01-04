import { Product, ProductStatus, ProductType } from '@app/models';

export interface ProductSearchRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  typeArticle?: ProductType;
  entrepotId?: string;
  statut?: ProductStatus;
  marqueId?: string;
  familleId?: string;
  sousFamilleId?: string;
  stockMin?: number;
  stockMax?: number;
  prixMin?: number;
  prixMax?: number;
  stockBas?: boolean;
  rupture?: boolean;
  peremptionProche?: boolean;
}

export interface ProductSearchResponse {
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
