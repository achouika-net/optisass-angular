import { IsString, IsOptional, IsUUID, IsNumber, IsEnum } from 'class-validator';

export enum EntrepotType {
    PRINCIPAL = 'PRINCIPAL',
    SECONDAIRE = 'SECONDAIRE',
    TRANSIT = 'TRANSIT',
}

export class CreateEntrepotDto {
    @IsString()
    nom: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(EntrepotType)
    type: EntrepotType;

    @IsOptional()
    @IsNumber()
    capaciteMax?: number;

    @IsOptional()
    @IsNumber()
    surface?: number;

    @IsOptional()
    @IsString()
    responsable?: string;

    @IsUUID()
    centreId: string;
}
