import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserCentreRoleDto {
    @IsString()
    @IsNotEmpty()
    centreId: string;

    @IsString()
    @IsNotEmpty()
    centreName: string;

    @IsString()
    @IsNotEmpty()
    role: string;

    @IsArray()
    @IsOptional()
    entrepotIds?: string[];

    @IsArray()
    @IsOptional()
    entrepotNames?: string[];
}

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    nom: string;

    @IsString()
    @IsNotEmpty()
    prenom: string;

    @IsString()
    @IsNotEmpty()
    civilite: string;

    @IsString()
    @IsOptional()
    telephone?: string;

    @IsEmail()
    email: string;

    @IsString()
    @IsOptional()
    photoUrl?: string;

    @IsString()
    @IsOptional()
    employeeId?: string; // New Linkage field

    @IsString()
    @IsOptional()
    matricule?: string;

    @IsString()
    @IsOptional()
    statut?: string;

    @IsString()
    @IsOptional()
    password?: string;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => CreateUserCentreRoleDto)
    centreRoles?: CreateUserCentreRoleDto[];
}
