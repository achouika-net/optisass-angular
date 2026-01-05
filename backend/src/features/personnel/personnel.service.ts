import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class PersonnelService {
    constructor(private prisma: PrismaService) { }

    async create(createEmployeeDto: CreateEmployeeDto) {
        const { centreIds, ...data } = createEmployeeDto;

        return this.prisma.employee.create({
            data: {
                ...data,
                dateEmbauche: data.dateEmbauche ? new Date(data.dateEmbauche) : new Date(),
                centres: {
                    create: centreIds.map(id => ({ centreId: id }))
                }
            },
            include: {
                centres: {
                    include: { centre: { select: { nom: true } } }
                }
            }
        });
    }

    async findAll(centreId?: string) {
        const whereClause: any = {};
        if (centreId) {
            whereClause.centres = {
                some: { centreId }
            };
        }

        return this.prisma.employee.findMany({
            where: whereClause,
            include: {
                centres: {
                    include: { centre: { select: { nom: true } } }
                }
            },
            orderBy: { nom: 'asc' }
        });
    }

    async findOne(id: string) {
        const employee = await this.prisma.employee.findUnique({
            where: { id },
            include: {
                centres: {
                    include: { centre: { select: { nom: true } } }
                },
                user: {
                    select: { email: true, centreRoles: true }
                }
            }
        });

        if (!employee) throw new NotFoundException(`Employé avec l'ID ${id} non trouvé`);
        return employee;
    }

    async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
        const { centreIds, ...data } = updateEmployeeDto;

        return this.prisma.$transaction(async (tx) => {
            if (centreIds) {
                // Delete existing ones
                await tx.employeeCentre.deleteMany({
                    where: { employeeId: id }
                });

                // Add new ones
                await tx.employeeCentre.createMany({
                    data: centreIds.map(cId => ({
                        employeeId: id,
                        centreId: cId
                    }))
                });
            }

            return tx.employee.update({
                where: { id },
                data: {
                    ...data,
                    dateEmbauche: data.dateEmbauche ? new Date(data.dateEmbauche) : undefined,
                },
                include: {
                    centres: {
                        include: { centre: { select: { nom: true } } }
                    }
                }
            });
        });
    }

    async remove(id: string) {
        return this.prisma.employee.delete({
            where: { id }
        });
    }
}
