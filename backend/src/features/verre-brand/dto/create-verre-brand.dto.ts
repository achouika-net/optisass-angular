export class CreateVerreBrandDto {
  glassIndexId: string;
  brandId: string;
  epaisseur?: number;
  prixAchat: number;
  prixVente?: number;
  reference?: string;
  notes?: string;
  actif?: boolean;
}

export class UpdateVerreBrandDto {
  epaisseur?: number;
  prixAchat?: number;
  prixVente?: number;
  reference?: string;
  notes?: string;
  actif?: boolean;
}

export class AjusterStockDto {
  delta: number;
  motif: string;
}
