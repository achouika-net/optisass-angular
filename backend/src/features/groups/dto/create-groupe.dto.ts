import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateGroupeDto {
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
    telephone?: string;

    @IsOptional()
    @IsEmail()
    email?: string;
}
