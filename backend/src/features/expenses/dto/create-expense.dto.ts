import { IsString, IsNumber, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateExpenseDto {
    @IsDateString()
    date: string; // ISO Date

    @IsNumber()
    montant: number;

    @IsString()
    categorie: string; // Enum-like string

    @IsOptional()
    @IsString()
    description?: string;

    @IsString()
    modePaiement: string;

    @IsString()
    statut: string;

    @IsOptional()
    @IsString()
    justificatifUrl?: string;

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsDateString()
    dateEcheance?: string;

    @IsUUID()
    centreId: string;

    @IsOptional()
    @IsUUID()
    factureFournisseurId?: string;

    @IsOptional()
    @IsString()
    creePar?: string;

    @IsOptional()
    @IsString()
    banque?: string;

    @IsOptional()
    @IsUUID()
    fournisseurId?: string;

    @IsOptional()
    @IsUUID()
    echeanceId?: string;

    @IsOptional()
    @IsUUID()
    employeeId?: string;
}
