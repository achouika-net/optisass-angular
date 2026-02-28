import { PartialType } from '@nestjs/mapped-types';
import { CreateCentreDto } from './create-centre.dto';

export class UpdateCentreDto extends PartialType(CreateCentreDto) {}
