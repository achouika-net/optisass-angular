import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { CommissionService } from './commission.service';
import { AttendanceService } from './attendance.service';
import { PayslipService } from './payslip.service';
import { ExpensesService } from '../expenses/expenses.service';

@Injectable()
export class PayrollService {
    constructor(
        private prisma: PrismaService,
        private commissionService: CommissionService,
        private attendanceService: AttendanceService,
        private payslipService: PayslipService,
        private expensesService: ExpensesService
    ) { }

    async generate(dto: GeneratePayrollDto) {
        const { employeeId, mois, annee } = dto;

        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
            include: { centres: true }
        });

        if (!employee) throw new NotFoundException('Employé non trouvé');

        // Check if payroll already exists
        const existing = await this.prisma.payroll.findFirst({
            where: { employeeId, mois, annee }
        });

        if (existing && existing.statut !== 'BROUILLON') {
            throw new BadRequestException('Un bulletin validé ou payé existe déjà pour ce mois');
        }

        // Aggregate data
        const totalCommissions = await this.commissionService.getTotalCommissions(employeeId, mois);
        const attendanceStats = await this.attendanceService.getStats(employeeId, mois, annee);

        // Simple logic for overtime and deductions (can be refined)
        const overtime = 0; // To be implemented later or manual input
        const deductions = attendanceStats.absencesCount * (employee.salaireBase / 30); // Deduction per day

        const netAPayer = employee.salaireBase + totalCommissions + overtime - deductions;

        if (existing) {
            return this.prisma.payroll.update({
                where: { id: existing.id },
                data: {
                    salaireBase: employee.salaireBase,
                    commissions: totalCommissions,
                    heuresSup: overtime,
                    retenues: deductions,
                    netAPayer: netAPayer
                }
            });
        }

        return this.prisma.payroll.create({
            data: {
                employeeId,
                mois,
                annee,
                salaireBase: employee.salaireBase,
                commissions: totalCommissions,
                heuresSup: overtime,
                retenues: deductions,
                netAPayer: netAPayer,
                statut: 'BROUILLON'
            }
        });
    }

    async validate(id: string) {
        const payroll = await this.prisma.payroll.findUnique({
            where: { id },
            include: { employee: true }
        });

        if (!payroll) throw new NotFoundException('Bulletin non trouvé');

        // Generate PDF
        const commissions = await this.commissionService.getEmployeeCommissions(payroll.employeeId, payroll.mois);
        const pdfUrl = await this.payslipService.generate(payroll.employee, payroll, commissions) as string;

        return this.prisma.payroll.update({
            where: { id },
            data: {
                statut: 'VALIDE',
                pdfUrl
            }
        });
    }

    async markAsPaid(id: string, centreId: string, userId: string) {
        const payroll = await this.prisma.payroll.findUnique({
            where: { id },
            include: { employee: true }
        });

        if (!payroll) throw new NotFoundException('Bulletin non trouvé');
        if (payroll.statut === 'PAYE') throw new BadRequestException('Bulletin déjà payé');

        return this.prisma.$transaction(async (tx) => {
            // Create Expense
            const expense = await this.expensesService.create({
                date: new Date().toISOString(),
                montant: payroll.netAPayer,
                categorie: 'SALAIRES',
                description: `Salaire ${payroll.mois}/${payroll.annee} - ${payroll.employee.nom} ${payroll.employee.prenom}`,
                modePaiement: 'VIREMENT', // Default
                statut: 'VALIDEE',
                centreId: centreId, // Usually paid from the main centre or passed by user
                creePar: userId
            } as any);

            return tx.payroll.update({
                where: { id },
                data: {
                    statut: 'PAYE',
                    expenseId: expense.id
                }
            });
        });
    }

    async findAll(mois?: string, annee?: number, centreId?: string) {
        const where: any = {};
        if (mois) where.mois = mois;
        if (annee) where.annee = annee;
        if (centreId) {
            where.employee = {
                centres: { some: { centreId } }
            };
        }

        return this.prisma.payroll.findMany({
            where,
            include: { employee: true },
            orderBy: [{ annee: 'desc' }, { mois: 'desc' }]
        });
    }
}
