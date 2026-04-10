import { PartialType } from '@nestjs/mapped-types';
import { CreatePaiementDto } from './create-paiement.dto';

export class UpdatePaiementDto extends PartialType(CreatePaiementDto) {}
