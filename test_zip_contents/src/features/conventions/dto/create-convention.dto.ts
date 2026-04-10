import { IsString, IsOptional, IsEmail, IsNumber, IsBoolean } from 'class-validator';

export enum RemiseType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT_AMOUNT = 'FLAT_AMOUNT',
}

export class CreateConventionDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsString()
  remiseType: string;

  @IsNumber()
  remiseValeur: number;

  @IsOptional()
  @IsNumber()
  montantForfaitaire?: number;

  @IsOptional()
  @IsBoolean()
  remiseForfaitaire?: boolean;

  @IsOptional()
  @IsNumber()
  montantForfaitaireMonture?: number;

  @IsOptional()
  @IsNumber()
  montantForfaitaireVerre?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
