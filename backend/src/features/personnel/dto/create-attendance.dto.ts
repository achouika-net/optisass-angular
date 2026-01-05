import { IsDateString, IsNumber, IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAttendanceDto {
    @IsUUID()
    employeeId: string;

    @IsDateString()
    date: string;

    @IsNumber()
    heuresTravaillees: number;

    @IsNumber()
    retardMinutes: number;

    @IsBoolean()
    estAbsent: boolean;

    @IsOptional()
    @IsString()
    motif?: string;
}
