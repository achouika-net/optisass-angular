import { IsString, IsOptional, IsNumber, IsDateString, IsArray, IsUUID, IsBoolean } from 'class-validator';

export class CreateEmployeeDto {
    @IsOptional()
    @IsString()
    matricule?: string;

    @IsString()
    nom: string;

    @IsString()
    prenom: string;

    @IsOptional()
    @IsString()
    cin?: string;

    @IsOptional()
    @IsString()
    telephone?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsOptional()
    @IsString()
    adresse?: string;

    @IsOptional()
    @IsString()
    photoUrl?: string; // New field for photo


    @IsString()
    poste: string; // OPTICIEN, VENDEUR, CAISSIER, RESPONSABLE, ADMIN

    @IsString()
    contrat: string; // CDI, CDD, JOURNALIER, PARTIEL

    @IsOptional()
    @IsDateString()
    dateEmbauche?: string;

    @IsNumber()
    salaireBase: number;

    @IsOptional()
    @IsString()
    statut?: string; // ACTIF, SUSPENDU, SORTI

    @IsArray()
    @IsUUID('4', { each: true })
    centreIds: string[];

    @IsOptional()
    @IsUUID()
    userId?: string;

    @IsOptional()
    @IsNumber()
    childrenCount?: number;

    @IsOptional()
    @IsString()
    familyStatus?: string; // CELIBATAIRE, MARIE

    @IsOptional()
    @IsString()
    paymentMode?: string;

    @IsOptional()
    @IsBoolean()
    socialSecurityAffiliation?: boolean;
}
