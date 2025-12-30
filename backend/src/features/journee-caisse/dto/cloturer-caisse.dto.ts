import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CloturerCaisseDto {
    @IsNumber()
    soldeReel: number;

    @IsOptional()
    @IsString()
    justificationEcart?: string;

    @IsString()
    responsableCloture: string;
}
