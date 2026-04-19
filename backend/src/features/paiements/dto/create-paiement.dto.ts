import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  IsPositive,
  IsEnum,
} from 'class-validator';

export class CreatePaiementDto {
  @IsNotEmpty()
  @IsString()
  factureId: string;

  @IsNotEmpty()
  @IsNumber()
  // BUG-004 FIX: Validate montant must be a valid positive number
  // Note: Can be negative for refunds, but must be finite
  montant: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsNotEmpty()
  @IsString()
  @IsEnum(['ESPECES', 'ESPECE', 'CARTE', 'CHEQUE', 'CHÈQUE', 'VIREMENT', 'LCN', 'AUTRE'], {
    message: 'Mode de paiement invalide',
  })
  mode: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  dateVersement?: string;

  @IsOptional()
  @IsString()
  banque?: string;

  @IsOptional()
  @IsString()
  tiersNom?: string;

  @IsOptional()
  @IsString()
  tiersCin?: string;

  @IsOptional()
  @IsString()
  remarque?: string;

  @IsOptional()
  @IsString()
  pieceJointe?: string;

  @IsOptional()
  @IsString()
  statut?: string;

  @IsOptional()
  @IsDateString()
  dateEncaissement?: string;
}
