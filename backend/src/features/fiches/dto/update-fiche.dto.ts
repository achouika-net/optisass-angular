import { PartialType } from '@nestjs/mapped-types';
import { CreateFicheDto } from './create-fiche.dto';

export class UpdateFicheDto extends PartialType(CreateFicheDto) {}
