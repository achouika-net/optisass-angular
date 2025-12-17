import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateCentreDto {
    @IsString()
    nom: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    adresse?: string;

    @IsOptional()
    @IsString()
    ville?: string;

    @IsOptional()
    @IsString()
    codePostal?: string;

    @IsOptional()
    @IsString()
    telephone?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsUUID()
    groupeId: string;
}
