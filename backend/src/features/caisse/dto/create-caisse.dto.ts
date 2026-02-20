import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum CaisseStatut {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

export enum CaisseType {
    PRINCIPALE = 'PRINCIPALE',
    DEPENSES = 'DEPENSES',
    MIXTE = 'MIXTE',
}

export class CreateCaisseDto {
    @IsString()
    nom: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(CaisseType)
    type?: CaisseType;

    @IsOptional()
    @IsEnum(CaisseStatut)
    statut?: CaisseStatut;

    @IsString()
    centreId: string;
}
