import { IsString, IsNumber, IsUUID } from 'class-validator';

export class GeneratePayrollDto {
    @IsUUID()
    employeeId: string;

    @IsString()
    mois: string; // YYYY-MM

    @IsNumber()
    annee: number;
}
