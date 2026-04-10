import {
    IsString,
    IsNumber,
    IsDateString,
    IsOptional,
    IsUUID,
    IsArray,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateEcheanceDto {
    @IsString()
    type: string;

    @IsDateString()
    dateEcheance: string;

    @IsNumber()
    montant: number;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    banque?: string;

    @IsString()
    statut: string;
}

export class CreateBonLivraisonDto {
    @IsString()
    numeroBL: string;

    @IsDateString()
    dateEmission: string;

    @IsOptional()
    @IsDateString()
    dateEcheance?: string;

    @IsNumber()
    montantHT: number;

    @IsNumber()
    montantTVA: number;

    @IsNumber()
    montantTTC: number;

    @IsString()
    statut: string;

    @IsString()
    type: string;

    @IsOptional()
    @IsString()
    pieceJointeUrl?: string;

    @IsUUID()
    fournisseurId: string;

    @IsOptional()
    @IsUUID()
    centreId?: string;

    @IsOptional()
    @IsUUID()
    clientId?: string;

    @IsOptional()
    @IsUUID()
    ficheId?: string;

    @IsOptional()
    @IsString()
    categorieBL?: string;

    @IsOptional()
    @IsUUID()
    factureFournisseurId?: string;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEcheanceDto)
    echeances?: CreateEcheanceDto[];

    @IsOptional()
    @IsString()
    base64File?: string;

    @IsOptional()
    @IsString()
    fileName?: string;
}
