import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString, Min } from 'class-validator';

export class CreatePaiementDto {
    @IsNotEmpty()
    @IsString()
    factureId: string;

    @IsNotEmpty()
    @IsNumber()
    @Min(0.01, { message: 'Le montant doit être supérieur à 0' })
    montant: number;

    @IsOptional()
    @IsDateString()
    date?: string;

    @IsNotEmpty()
    @IsString()
    mode: string; // ESPECES, CHEQUE, CARTE, VIREMENT, AUTRE

    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsDateString()
    dateVersement?: string;

    @IsOptional()
    @IsString()
    banque?: string;

    @IsOptional()
    @IsString()
    tiersNom?: string;

    @IsOptional()
    @IsString()
    tiersCin?: string;

    @IsOptional()
    @IsString()
    remarque?: string;

    @IsOptional()
    @IsString()
    pieceJointe?: string;
}
