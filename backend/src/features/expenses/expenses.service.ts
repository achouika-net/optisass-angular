import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
    constructor(private prisma: PrismaService) { }

    async create(createExpenseDto: CreateExpenseDto) {
        const { reference, dateEcheance, ...data } = createExpenseDto;

        return this.prisma.$transaction(async (tx) => {
            let echeanceId: string | undefined = undefined;

            if ((data.modePaiement === 'CHEQUE' || data.modePaiement === 'LCN') && dateEcheance) {
                const echeance = await tx.echeancePaiement.create({
                    data: {
                        type: data.modePaiement,
                        reference: reference,
                        dateEcheance: new Date(dateEcheance),
                        montant: data.montant,
                        statut: 'EN_ATTENTE',
                        banque: data.banque,
                    }
                });
                echeanceId = echeance.id;
            }

            return tx.depense.create({
                data: {
                    ...data,
                    reference,
                    dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
                    echeanceId: echeanceId
                },
            });
        });
    }

    async findAll(centreId?: string, startDate?: string, endDate?: string) {
        const whereClause: any = {};

        if (centreId) {
            whereClause.centreId = centreId;
        }

        if (startDate && endDate) {
            whereClause.date = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        return this.prisma.depense.findMany({
            where: whereClause,
            include: {
                centre: { select: { nom: true } },
                factureFournisseur: { select: { numeroFacture: true, fournisseur: { select: { nom: true } } } }
            },
            orderBy: { date: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.depense.findUnique({
            where: { id },
            include: {
                factureFournisseur: true,
                centre: true
            }
        });
    }

    async update(id: string, updateExpenseDto: any) {
        return this.prisma.depense.update({
            where: { id },
            data: updateExpenseDto,
        });
    }

    async remove(id: string) {
        return this.prisma.depense.delete({
            where: { id },
        });
    }
}
