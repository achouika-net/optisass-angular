import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFicheDto {
    @IsString()
    @IsNotEmpty()
    statut: string;

    @IsString()
    @IsNotEmpty()
    type: string;

    @IsOptional()
    @IsDateString()
    dateLivraisonEstimee?: string;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    montantTotal?: number;

    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    montantPaye?: number;

    @IsString()
    @IsNotEmpty()
    clientId: string;

    @IsObject()
    @IsOptional()
    content?: any;

    // Explicitly allow sub-objects to pass whitelist validation
    @IsOptional()
    montage?: any;

    @IsOptional()
    verres?: any;

    @IsOptional()
    monture?: any;

    @IsOptional()
    ordonnance?: any;

    @IsOptional()
    suggestions?: any;

    @IsOptional()
    equipements?: any;

    // Support for loose fields that frontend might send
    [key: string]: any;
}
