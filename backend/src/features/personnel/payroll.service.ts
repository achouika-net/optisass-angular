import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
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
        const totalCommissions = await this.commissionService.getTotalCommissions(employeeId, mois, annee);
        const attendanceStats = await this.attendanceService.getStats(employeeId, mois, annee);

        // Simple manual input placeholders (can be extended to attendance-based)
        const overtime = 0;
        const primes = 0;
        const deductions = attendanceStats.absencesCount * (employee.salaireBase / 30);

        const config = await this.getOrCreateConfig(annee);
        const calc = this.calculatePayrollInternal(employee, {
            salaireBase: employee.salaireBase,
            commissions: totalCommissions,
            heuresSup: overtime,
            primes: primes,
            retenues: deductions,
            avances: 0
        }, config);

        if (existing) {
            return this.prisma.payroll.update({
                where: { id: existing.id },
                data: {
                    ...calc,
                    statut: existing.statut // keep existing status
                }
            });
        }

        return this.prisma.payroll.create({
            data: {
                employeeId,
                mois,
                annee,
                ...calc,
                statut: 'BROUILLON'
            }
        });
    }

    private async getOrCreateConfig(annee: number) {
        let config = await this.prisma.payrollConfig.findUnique({ where: { annee } });
        if (!config) {
            // Seed default international/Moroccan config if missing
            const is2025OrMore = annee >= 2025;

            config = await this.prisma.payrollConfig.create({
                data: {
                    annee,
                    socialSecurityRate_S: 4.48,
                    socialSecurityRate_P: 8.98, // Capped
                    familyAllowanceRate_P: 6.40, // Uncapped
                    trainingRate_P: 1.60, // Uncapped
                    socialSecurityCap: 6000,
                    healthInsuranceRate_S: 2.26,
                    healthInsuranceRate_P: 4.11, // Uncapped
                    profExpensesRate: 20,
                    profExpensesCap: 2500,
                    familyDeduction: 30,
                    familyDeductionCap: 180,
                    incomeTaxBrackets: is2025OrMore ? [
                        // New 2025 Brackets (Morocco LF 2025)
                        { min: 0, max: 3333.33, rate: 0, deduction: 0 },
                        { min: 3333.34, max: 5000, rate: 10, deduction: 333.33 },
                        { min: 5000.01, max: 6666.67, rate: 20, deduction: 833.33 },
                        { min: 6666.68, max: 8333.33, rate: 30, deduction: 1500 },
                        { min: 8333.34, max: 15000, rate: 34, deduction: 1833.33 },
                        { min: 15000.01, max: null, rate: 37, deduction: 2283.33 }
                    ] : [
                        // Pre-2025 Brackets
                        { min: 0, max: 2500, rate: 0, deduction: 0 },
                        { min: 2501, max: 4166.67, rate: 10, deduction: 250 },
                        { min: 4166.68, max: 5000, rate: 20, deduction: 666.67 },
                        { min: 5000.01, max: 6666.67, rate: 30, deduction: 1166.67 },
                        { min: 6666.68, max: 15000, rate: 34, deduction: 1433.33 },
                        { min: 15000.01, max: null, rate: 38, deduction: 2033.33 }
                    ] as any
                }
            });
        }
        return config;
    }

    private calculatePayrollInternal(employee: any, inputs: { salaireBase: number, commissions: number, heuresSup: number, primes: number, retenues: number, avances?: number }, config: any) {
        const grossSalary = inputs.salaireBase + inputs.commissions + inputs.heuresSup + inputs.primes;
        const isAffiliated = employee.socialSecurityAffiliation !== false;
        const advances = inputs.avances || 0;

        // 🟢 ÉTAPE 1 : SALAIRE BRUT GLOBAL
        // (Base + Commissions + Heures Sup + Primes/Indemnités)
        // const grossSalary = salaireBase + commissions + heuresSup + primes; // This line is now redundant

        // 🔵 ÉTAPE 2 : COTISATIONS SOCIALES (Part Salarié)
        // CNSS (Plafonnée à 6000 DH)
        const socialSecurityBase = Math.min(grossSalary, config.socialSecurityCap);
        const socialSecurityDeduction = isAffiliated
            ? (socialSecurityBase * config.socialSecurityRate_S) / 100
            : 0;

        // AMO (Assurance Maladie - Non Plafonnée)
        const healthInsuranceDeduction = isAffiliated
            ? (grossSalary * config.healthInsuranceRate_S) / 100
            : 0;

        // 🟠 ÉTAPE 3 : FRAIS PROFESSIONNELS
        // Ils sont déduits après les cotisations sociales pour obtenir la base imposable
        const taxableBaseForProfExpenses = grossSalary - socialSecurityDeduction - healthInsuranceDeduction;
        const professionalExpenses = Math.min(
            (taxableBaseForProfExpenses * config.profExpensesRate) / 100,
            config.profExpensesCap
        );

        // 🟡 ÉTAPE 4 : SALAIRE NET IMPOSABLE (SNI)
        // SNI = Brut - CNSS - AMO - Frais Pro
        const taxableNet = taxableBaseForProfExpenses - professionalExpenses;

        // 🔴 ÉTAPE 5 : IMPÔT SUR LE REVENU (IR)
        // L'IGR est calculé UNIQUEMENT sur le Salaire Net Imposable
        let incomeTaxDeduction = 0;
        const brackets = Array.isArray(config.incomeTaxBrackets) ? config.incomeTaxBrackets : [];
        const bracket = brackets.find((b: any) => taxableNet >= b.min && (b.max === null || taxableNet <= b.max));

        if (bracket) {
            incomeTaxDeduction = (taxableNet * bracket.rate / 100) - (bracket.deduction || 0);
        }

        // Déductions pour charges de famille (30 DH par personne : Enfants + Conjoint si marié, plafonné à familyDeductionCap)
        const dependentCount = (employee.childrenCount || 0) + (employee.familyStatus === 'MARIE' ? 1 : 0);
        const familyDeduction = Math.min(
            dependentCount * (config.familyDeduction || 0),
            config.familyDeductionCap || 180
        );
        incomeTaxDeduction = Math.max(0, incomeTaxDeduction - familyDeduction);

        // 💼 ÉTAPE 6 : CHARGES PATRONALES
        const employerSSBase = Math.min(grossSalary, config.socialSecurityCap);
        const employerSS = (employerSSBase * config.socialSecurityRate_P) / 100;
        const employerAF = (grossSalary * (config.familyAllowanceRate_P || 0)) / 100;
        const employerTFP = (grossSalary * (config.trainingRate_P || 0)) / 100;
        const employerHealth = (grossSalary * config.healthInsuranceRate_P) / 100;
        const employerCharges = employerSS + employerAF + employerTFP + employerHealth;

        // 🏁 ÉTAPE 7 : NET À PAYER FINAL
        const netAPayer = Math.max(0, taxableNet - incomeTaxDeduction - advances);

        return {
            salaireBase: inputs.salaireBase,
            primes: inputs.primes,
            commissions: inputs.commissions,
            heuresSup: inputs.heuresSup,
            retenues: inputs.retenues,
            grossSalary,
            socialSecurityDeduction,
            healthInsuranceDeduction,
            incomeTaxDeduction,
            professionalExpenses,
            taxableNet,
            employerCharges,
            netAPayer,
            avances: advances
        };
    }

    async validate(id: string) {
        const payroll = await this.prisma.payroll.findUnique({
            where: { id },
            include: { employee: true }
        });

        if (!payroll) throw new NotFoundException('Bulletin non trouvé');

        // Generate PDF
        const commissions = await this.commissionService.getEmployeeCommissions(payroll.employeeId, payroll.mois, payroll.annee);
        const pdfUrl = await this.payslipService.generate(payroll.employee, payroll, commissions) as string;

        return this.prisma.payroll.update({
            where: { id },
            data: {
                statut: 'VALIDE',
                pdfUrl
            }
        });
    }

    async getGeneratedPdf(id: string) {
        try {
            console.log(`[PayrollService] Generating PDF for payroll ID: ${id}`);
            const payroll = await this.prisma.payroll.findUnique({
                where: { id },
                include: { employee: true }
            });

            if (!payroll) {
                console.error(`[PayrollService] Payroll ${id} not found`);
                throw new NotFoundException('Bulletin non trouvé');
            }

            console.log(`[PayrollService] Found payroll for ${payroll.employee?.nom}. Fetching commissions...`);
            const commissions = await this.commissionService.getEmployeeCommissions(payroll.employeeId, payroll.mois, payroll.annee);

            const config = await this.getOrCreateConfig(payroll.annee);

            console.log(`[PayrollService] Commissions count: ${commissions.length}. Calling payslipService.generate...`);
            // Force re-generation
            const pdfUrl = await this.payslipService.generate(payroll.employee, payroll, commissions, config);
            console.log(`[PayrollService] PDF generated successfully: ${pdfUrl}`);
            return pdfUrl;
        } catch (error) {
            console.error(`[PayrollService] Error generating PDF for payroll ${id}:`, error);
            throw error;
        }
    }

    async markAsPaid(id: string, centreId: string, userId: string, modePaiement: string = 'VIREMENT', banque?: string, reference?: string, dateEcheance?: string) {
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
                modePaiement: modePaiement,
                banque: banque,
                reference: reference, // Check number or transaction ref
                dateEcheance: dateEcheance,
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
            include: {
                employee: {
                    include: {
                        centres: true
                    }
                }
            },
            orderBy: [{ annee: 'desc' }, { mois: 'desc' }]
        });
    }
    async update(id: string, dto: UpdatePayrollDto) {
        const payroll = await this.prisma.payroll.findUnique({ where: { id } });
        if (!payroll) throw new NotFoundException('Bulletin non trouvé');

        const updates: any = { ...dto };

        // Recalculate Net if financial fields change
        if (
            dto.salaireBase !== undefined ||
            dto.commissions !== undefined ||
            dto.heuresSup !== undefined ||
            dto.primes !== undefined ||
            dto.retenues !== undefined ||
            dto.avances !== undefined
        ) {
            const salaireBase = dto.salaireBase ?? payroll.salaireBase;
            const commissions = dto.commissions ?? payroll.commissions;
            const heuresSup = dto.heuresSup ?? payroll.heuresSup;
            const retenues = dto.retenues ?? payroll.retenues;
            const advances = dto.avances ?? (payroll as any).avances ?? 0;
            const primes = dto.primes ?? (payroll as any).primes ?? 0;

            const config = await this.getOrCreateConfig(payroll.annee);
            const employee = await this.prisma.employee.findUnique({ where: { id: payroll.employeeId } });

            const calc = this.calculatePayrollInternal(employee, {
                salaireBase,
                commissions,
                heuresSup,
                primes,
                retenues,
                avances: advances
            }, config);

            Object.assign(updates, calc);
        }

        return this.prisma.payroll.update({
            where: { id },
            data: updates
        });
    }

    async remove(id: string) {
        return this.prisma.payroll.delete({
            where: { id }
        });
    }
}
