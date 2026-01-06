import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdatePayrollDto {
    @IsOptional()
    @IsNumber()
    salaireBase?: number;

    @IsOptional()
    @IsNumber()
    commissions?: number;

    @IsOptional()
    @IsNumber()
    heuresSup?: number;

    @IsOptional()
    @IsNumber()
    retenues?: number;

    @IsOptional()
    @IsString()
    statut?: string;
}
