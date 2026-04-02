import { IsString, IsOptional, IsEmail, ValidateIf } from 'class-validator';

export class CreateGroupeDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @ValidateIf(
    (o: CreateGroupeDto) =>
      o.email !== '' && o.email !== null && o.email !== undefined,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
