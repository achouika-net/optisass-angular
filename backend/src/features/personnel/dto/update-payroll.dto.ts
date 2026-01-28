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
    primes?: number;

    @IsOptional()
    @IsNumber()
    retenues?: number;

    @IsOptional()
    @IsNumber()
    avances?: number;

    @IsOptional()
    @IsNumber()
    grossSalary?: number;

    @IsOptional()
    @IsNumber()
    socialSecurityDeduction?: number;

    @IsOptional()
    @IsNumber()
    healthInsuranceDeduction?: number;

    @IsOptional()
    @IsNumber()
    incomeTaxDeduction?: number;

    @IsOptional()
    @IsNumber()
    professionalExpenses?: number;

    @IsOptional()
    @IsNumber()
    employerCharges?: number;

    @IsOptional()
    @IsNumber()
    netAPayer?: number;

    @IsOptional()
    @IsString()
    statut?: string;
}
