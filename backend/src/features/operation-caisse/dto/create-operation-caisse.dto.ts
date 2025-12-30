import { IsString, IsNumber, IsOptional, IsEnum, Min, ValidateIf } from 'class-validator';

export enum OperationType {
    ENCAISSEMENT = 'ENCAISSEMENT',
    DECAISSEMENT = 'DECAISSEMENT',
}

export enum TypeOperation {
    COMPTABLE = 'COMPTABLE',
    INTERNE = 'INTERNE',
}

export enum MoyenPaiement {
    ESPECES = 'ESPECES',
    CARTE = 'CARTE',
    VIREMENT = 'VIREMENT',
    CHEQUE = 'CHEQUE',
}

export class CreateOperationCaisseDto {
    @IsEnum(OperationType)
    type: OperationType;

    @IsEnum(TypeOperation)
    typeOperation: TypeOperation;

    @IsNumber()
    @Min(0)
    montant: number;

    @IsEnum(MoyenPaiement)
    moyenPaiement: MoyenPaiement;

    @IsOptional()
    @IsString()
    reference?: string;

    @ValidateIf((o) => o.type === OperationType.DECAISSEMENT)
    @IsString()
    motif?: string;

    @IsOptional()
    @IsString()
    pieceJointe?: string;

    @IsString()
    utilisateur: string;

    @IsString()
    journeeCaisseId: string;

    @IsOptional()
    @IsString()
    factureId?: string;
}
