import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ExportSageDto {
    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsString()
    centreId?: string;
}
