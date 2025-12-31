import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CloturerCaisseDto {
    @IsNumber()
    soldeReel: number; // Espèces

    // Carte reconciliation
    @IsNumber()
    nbRecuCarte: number;

    @IsNumber()
    montantTotalCarte: number;

    // Cheque reconciliation
    @IsNumber()
    nbRecuCheque: number;

    @IsNumber()
    montantTotalCheque: number;

    @IsOptional()
    @IsString()
    justificationEcart?: string;

    @IsString()
    responsableCloture: string;
}
