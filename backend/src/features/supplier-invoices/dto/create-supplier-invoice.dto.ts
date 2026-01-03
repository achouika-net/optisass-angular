import { IsString, IsNumber, IsDateString, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateEcheanceDto {
    @IsString()
    type: string; // CHEQUE, LCN...

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

export class CreateSupplierInvoiceDto {
    @IsString()
    numeroFacture: string;

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
    statut: string; // EN_ATTENTE, VALIDEE...

    @IsString()
    type: string; // ACHAT_STOCK...

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
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEcheanceDto)
    echeances?: CreateEcheanceDto[];
}
