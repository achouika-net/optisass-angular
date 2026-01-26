import { IsString, IsNumber, IsDateString, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AllocationDto {
    @IsOptional()
    @IsUUID()
    productId?: string;

    @IsString()
    reference: string;

    @IsString()
    nom: string;

    @IsString()
    categorie: string;

    @IsOptional()
    @IsString()
    marque?: string;

    @IsUUID()
    warehouseId: string;

    @IsNumber()
    quantite: number;

    @IsNumber()
    prixAchat: number;

    @IsNumber()
    prixVente: number;

    @IsNumber()
    tva: number;

    @IsOptional()
    @IsString()
    materiau?: string;

    @IsOptional()
    @IsString()
    forme?: string;

    @IsOptional()
    @IsString()
    genre?: string;

    @IsOptional()
    @IsString()
    couleur?: string;

    @IsOptional()
    @IsString()
    calibre?: string;

    @IsOptional()
    @IsString()
    pont?: string;
}

export class BulkAlimentationDto {
    @IsString()
    numeroFacture: string;

    @IsDateString()
    dateEmission: string;

    @IsOptional()
    @IsDateString()
    dateEcheance?: string;

    @IsString()
    type: string; // FACTURE or BL

    @IsUUID()
    fournisseurId: string;

    @IsOptional()
    @IsUUID()
    centreId?: string;

    @IsOptional()
    @IsString()
    base64File?: string;

    @IsOptional()
    @IsString()
    fileName?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AllocationDto)
    allocations: AllocationDto[];
}
