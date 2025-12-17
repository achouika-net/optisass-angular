import { PartialType } from '@nestjs/mapped-types';
import { CreateEntrepotDto } from './create-entrepot.dto';

export class UpdateEntrepotDto extends PartialType(CreateEntrepotDto) { }
