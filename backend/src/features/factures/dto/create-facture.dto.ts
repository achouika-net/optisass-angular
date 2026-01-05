import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDate, IsArray, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export enum FactureType {
    FACTURE = 'FACTURE',
    DEVIS = 'DEVIS',
    AVOIR = 'AVOIR',
    BL = 'BL',
    PROFORMA = 'PROFORMA'
}

export class CreateFactureDto {
    @IsString()
    @IsOptional()
    numero?: string;

    @IsString()
    @IsNotEmpty()
    clientId: string;

    @IsString()
    @IsOptional()
    ficheId?: string;

    @IsEnum(FactureType)
    @IsNotEmpty()
    type: FactureType;

    @IsString()
    @IsNotEmpty()
    statut: string;

    @IsNumber()
    @Type(() => Number)
    @IsNotEmpty()
    totalHT: number;

    @IsNumber()
    @Type(() => Number)
    @IsNotEmpty()
    totalTTC: number;

    @IsNumber()
    @Type(() => Number)
    @IsOptional()
    totalTVA?: number;

    @IsNumber()
    @Type(() => Number)
    @IsOptional()
    remise?: number;

    @IsDate()
    @Type(() => Date)
    @IsNotEmpty()
    dateEmission: Date;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    dateEcheance?: Date;

    @IsArray()
    @IsOptional()
    lignes?: any[];

    @IsString()
    @IsOptional()
    centreId?: string;

    @IsNumber()
    @Type(() => Number)
    @IsOptional()
    acompteAPayer?: number;

    @IsNumber()
    @Type(() => Number)
    @IsOptional()
    resteAPayer?: number;

    @IsString()
    @IsOptional()
    montantLettres?: string;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsString()
    @IsOptional()
    originalFactureId?: string;

    @IsObject()
    @IsOptional()
    proprietes?: any;

    @IsString()
    @IsOptional()
    vendeurId?: string;
}
