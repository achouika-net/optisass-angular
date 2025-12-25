import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';

@Injectable()
export class SupplierInvoicesService {
    constructor(private prisma: PrismaService) { }

    async create(createDto: CreateSupplierInvoiceDto) {
        const { echeances, ...invoiceData } = createDto;

        return this.prisma.factureFournisseur.create({
            data: {
                ...invoiceData,
                echeances: echeances ? {
                    create: echeances
                } : undefined
            },
            include: {
                echeances: true,
                fournisseur: true
            }
        });
    }

    async findAll(fournisseurId?: string, statut?: string) {
        const whereClause: any = {};
        if (fournisseurId) whereClause.fournisseurId = fournisseurId;
        if (statut) whereClause.statut = statut;

        return this.prisma.factureFournisseur.findMany({
            where: whereClause,
            include: {
                fournisseur: true,
                echeances: true
            },
            orderBy: { dateEmission: 'desc' }
        });
    }

    async findOne(id: string) {
        return this.prisma.factureFournisseur.findUnique({
            where: { id },
            include: {
                fournisseur: true,
                echeances: true,
                depense: true
            }
        });
    }

    async update(id: string, updateDto: any) {
        return this.prisma.factureFournisseur.update({
            where: { id },
            data: updateDto,
        });
    }

    async remove(id: string) {
        return this.prisma.factureFournisseur.delete({
            where: { id },
        });
    }
}
