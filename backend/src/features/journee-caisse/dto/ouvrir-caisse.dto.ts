import { IsString, IsNumber, Min } from 'class-validator';

export class OuvrirCaisseDto {
    @IsString()
    caisseId: string;

    @IsString()
    centreId: string;

    @IsNumber()
    @Min(0)
    fondInitial: number;

    @IsString()
    caissier: string;
}
