import { IsString, IsArray, IsObject, IsOptional } from 'class-validator';

export class ExecuteImportDto {
    @IsOptional()
    type?: any;

    @IsOptional()
    data?: any[];

    @IsOptional()
    mapping?: any;

    @IsOptional()
    warehouseId?: any;

    @IsOptional()
    centreId?: any;

    @IsOptional()
    isBL?: any;
}
