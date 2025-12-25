import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

@Injectable()
export class SuppliersService {
    constructor(private prisma: PrismaService) { }

    async create(createSupplierDto: CreateSupplierDto) {
        return this.prisma.fournisseur.create({
            data: createSupplierDto,
        });
    }

    async findAll() {
        return this.prisma.fournisseur.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        return this.prisma.fournisseur.findUnique({
            where: { id },
            include: {
                factures: true,
            },
        });
    }

    async update(id: string, updateSupplierDto: any) {
        return this.prisma.fournisseur.update({
            where: { id },
            data: updateSupplierDto,
        });
    }

    async remove(id: string) {
        return this.prisma.fournisseur.delete({
            where: { id },
        });
    }
}
