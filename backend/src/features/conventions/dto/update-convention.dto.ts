import { PartialType } from '@nestjs/mapped-types';
import { CreateConventionDto } from './create-convention.dto';

export class UpdateConventionDto extends PartialType(CreateConventionDto) {}
