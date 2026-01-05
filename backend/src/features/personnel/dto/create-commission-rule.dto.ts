import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CreateCommissionRuleDto {
    @IsString()
    poste: string;

    @IsOptional()
    @IsUUID()
    centreId?: string;

    @IsString()
    typeProduit: string; // MONTURE, VERRE, LENTILLE, GLOBAL

    @IsNumber()
    taux: number;
}
