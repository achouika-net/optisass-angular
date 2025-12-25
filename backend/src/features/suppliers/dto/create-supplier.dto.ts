import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateSupplierDto {
    @IsString()
    nom: string;

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

    @IsOptional()
    @IsString()
    ville?: string;

    @IsOptional()
    @IsString()
    siteWeb?: string;

    @IsOptional()
    @IsString()
    ice?: string;

    @IsOptional()
    @IsString()
    rc?: string;

    @IsOptional()
    @IsString()
    identifiantFiscal?: string;

    @IsOptional()
    @IsString()
    patente?: string;

    @IsOptional()
    @IsString()
    cnss?: string;

    @IsOptional()
    @IsString()
    rib?: string;

    @IsOptional()
    @IsString()
    banque?: string;

    @IsOptional()
    @IsString()
    conditionsPaiement?: string;
}
