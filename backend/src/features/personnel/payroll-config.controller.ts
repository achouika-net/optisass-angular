import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('personnel/payroll-config')
export class PayrollConfigController {
    constructor(private prisma: PrismaService) { }

    @Get()
    findAll() {
        return this.prisma.payrollConfig.findMany({
            orderBy: { annee: 'desc' }
        });
    }

    @Get(':annee')
    findOne(@Param('annee') annee: string) {
        return this.prisma.payrollConfig.findUnique({
            where: { annee: parseInt(annee) }
        });
    }

    @Post()
    async create(@Body() data: any) {
        console.log('POST /personnel/payroll-config', data);
        const { id, createdAt, updatedAt, ...createData } = data;
        try {
            return await this.prisma.payrollConfig.create({
                data: {
                    ...createData,
                    annee: parseInt(data.annee)
                }
            });
        } catch (error) {
            console.error('❌ Error creating payroll config:', error);
            throw error;
        }
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() data: any) {
        console.log('PUT /personnel/payroll-config/' + id, data);
        const { id: _, createdAt: __, updatedAt: ___, ...updateData } = data;
        try {
            return await this.prisma.payrollConfig.update({
                where: { id },
                data: {
                    ...updateData,
                    annee: parseInt(data.annee)
                }
            });
        } catch (error) {
            console.error('Error updating payroll config:', error);
            throw error;
        }
    }
}
