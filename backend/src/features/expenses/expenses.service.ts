import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
    constructor(private prisma: PrismaService) { }

    async create(createExpenseDto: CreateExpenseDto) {
        return this.prisma.depense.create({
            data: createExpenseDto,
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
