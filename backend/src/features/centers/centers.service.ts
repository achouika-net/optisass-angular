import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCentreDto } from './dto/create-centre.dto';
import { UpdateCentreDto } from './dto/update-centre.dto';

@Injectable()
export class CentersService {
    constructor(private prisma: PrismaService) { }

    async create(createCentreDto: CreateCentreDto) {
        return this.prisma.centre.create({
            data: createCentreDto,
            include: {
                groupe: true,
                entrepots: true,
            },
        });
    }

    async findAll(groupeId?: string) {
        return this.prisma.centre.findMany({
            where: groupeId ? { groupeId } : undefined,
            include: {
                groupe: true,
                entrepots: true,
            },
        });
    }

    async findOne(id: string) {
        const centre = await this.prisma.centre.findUnique({
            where: { id },
            include: {
                groupe: true,
                entrepots: true,
            },
        });

        if (!centre) {
            throw new NotFoundException(`Centre with ID ${id} not found`);
        }

        return centre;
    }

    async update(id: string, updateCentreDto: UpdateCentreDto) {
        try {
            return await this.prisma.centre.update({
                where: { id },
                data: updateCentreDto,
                include: {
                    groupe: true,
                    entrepots: true,
                },
            });
        } catch (error) {
            throw new NotFoundException(`Centre with ID ${id} not found`);
        }
    }

    async remove(id: string) {
        try {
            await this.prisma.centre.delete({
                where: { id },
            });
            return { message: `Centre with ID ${id} deleted successfully` };
        } catch (error) {
            throw new NotFoundException(`Centre with ID ${id} not found`);
        }
    }
}
