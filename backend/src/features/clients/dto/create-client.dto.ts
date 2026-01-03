import { IsString, IsNotEmpty, IsOptional, IsEnum, IsEmail, IsDate, IsBoolean, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export enum ClientType {
    PARTICULIER = 'particulier',
    PROFESSIONNEL = 'professionnel',
    ANONYME = 'anonyme'
}

export class CreateClientDto {
    @IsEnum(ClientType)
    @IsNotEmpty()
    typeClient: ClientType;

    @IsString()
    @IsOptional()
    titre?: string;

    @IsString()
    @IsOptional()
    nom: string;

    @IsString()
    @IsOptional()
    prenom?: string;

    @IsString()
    @IsOptional()
    typePieceIdentite?: string;

    @IsString()
    @IsOptional()
    numeroPieceIdentite?: string;

    @IsString()
    @IsOptional()
    cinParent?: string;

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    dateNaissance?: Date;

    @IsString()
    @IsOptional()
    telephone?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    ville?: string;

    @IsString()
    @IsOptional()
    adresse?: string;

    @IsString()
    @IsOptional()
    codePostal?: string;

    @IsString()
    @IsOptional()
    statut?: string;

    @IsObject()
    @IsOptional()
    couvertureSociale?: any;

    @IsObject()
    @IsOptional()
    dossierMedical?: any;

    @IsObject()
    @IsOptional()
    groupeFamille?: any;

    // Professional fields
    @IsString()
    @IsOptional()
    raisonSociale?: string;

    @IsString()
    @IsOptional()
    identifiantFiscal?: string;

    @IsString()
    @IsOptional()
    ice?: string;

    @IsString()
    @IsOptional()
    registreCommerce?: string;

    @IsString()
    @IsOptional()
    patente?: string;

    @IsBoolean()
    @IsOptional()
    tvaAssujetti?: boolean;

    @IsString()
    @IsOptional()
    numeroAutorisation?: string;

    @IsString()
    @IsOptional()
    siteWeb?: string;

    @IsObject()
    @IsOptional()
    convention?: any;

    @IsObject()
    @IsOptional()
    contacts?: any;

    @IsString()
    @IsOptional()
    parrainId?: string;

    @IsString()
    @IsOptional()
    centreId?: string;
}
