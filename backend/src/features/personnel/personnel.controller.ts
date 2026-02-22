import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Headers } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { PersonnelService } from './personnel.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CommissionService } from './commission.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';

@Controller('personnel')
export class PersonnelController {
    constructor(
        private readonly personnelService: PersonnelService,
        private readonly attendanceService: AttendanceService,
        private readonly commissionService: CommissionService,
        private readonly payrollService: PayrollService,
        private readonly configService: ConfigService
    ) { }

    // --- Employees ---
    @Post('employees')
    createEmployee(@Body() createEmployeeDto: CreateEmployeeDto) {
        return this.personnelService.create(createEmployeeDto);
    }

    @Get('employees')
    findAllEmployees(@Query('centreId') centreId?: string) {
        return this.personnelService.findAll(centreId);
    }

    @Get('employees/:id')
    findOneEmployee(@Param('id') id: string) {
        return this.personnelService.findOne(id);
    }

    @Patch('employees/:id')
    updateEmployee(@Param('id') id: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
        console.log('PATCH /personnel/employees/' + id, updateEmployeeDto);
        return this.personnelService.update(id, updateEmployeeDto);
    }

    @Delete('employees/:id')
    removeEmployee(@Param('id') id: string) {
        return this.personnelService.remove(id);
    }

    // --- Attendance ---
    @Post('attendance')
    logAttendance(@Body() createAttendanceDto: CreateAttendanceDto) {
        return this.attendanceService.log(createAttendanceDto);
    }

    @Get('attendance/:employeeId')
    getMonthlyAttendance(
        @Param('employeeId') employeeId: string,
        @Query('month') month: string,
        @Query('year') year: string,
    ) {
        return this.attendanceService.getEmployeeMonthly(employeeId, month, parseInt(year));
    }

    // --- Commissions ---
    @Post('commission-rules')
    createCommissionRule(@Body() dto: CreateCommissionRuleDto) {
        return this.commissionService.createRule(dto);
    }

    @Get('commission-rules')
    getCommissionRules(@Query('centreId') centreId?: string) {
        return this.commissionService.getRules(centreId);
    }

    @Patch('commission-rules/:id')
    updateCommissionRule(@Param('id') id: string, @Body() dto: UpdateCommissionRuleDto) {
        return this.commissionService.updateRule(id, dto);
    }

    @Delete('commission-rules/:id')
    deleteCommissionRule(@Param('id') id: string) {
        return this.commissionService.deleteRule(id);
    }

    @Get('commissions/:employeeId')
    getEmployeeCommissions(
        @Param('employeeId') employeeId: string,
        @Query('mois') mois: string,
        @Query('annee') annee?: string,
    ) {
        return this.commissionService.getEmployeeCommissions(employeeId, mois, annee ? parseInt(annee) : undefined);
    }

    // --- Payroll ---
    @Post('payroll/generate')
    generatePayroll(@Body() dto: GeneratePayrollDto) {
        return this.payrollService.generate(dto);
    }

    @Post('payroll/:id/validate')
    validatePayroll(@Param('id') id: string) {
        return this.payrollService.validate(id);
    }

    @Post('payroll/:id/pay')
    payPayroll(
        @Param('id') id: string,
        @Body() body: { centreId: string, userId: string, modePaiement?: string, banque?: string, reference?: string, dateEcheance?: string },
        @Headers('authorization') authHeader?: string
    ) {
        const userId = this.getUserId(authHeader) || body.userId;
        return this.payrollService.markAsPaid(id, body.centreId, userId, body.modePaiement, body.banque, body.reference, body.dateEcheance);
    }

    private getUserId(authHeader?: string): string | undefined {
        if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;
        try {
            const token = authHeader.split(' ')[1];
            const secret = this.configService.get<string>('JWT_SECRET') || 'your-very-secret-key';
            const payload = jwt.verify(token, secret) as any;
            return payload.sub;
        } catch (e) {
            return undefined;
        }
    }

    @Get('payroll')
    findAllPayroll(
        @Query('mois') mois?: string,
        @Query('annee') annee?: string,
        @Query('centreId') centreId?: string,
    ) {
        return this.payrollService.findAll(mois, annee ? parseInt(annee) : undefined, centreId);
    }

    @Patch('payroll/:id')
    updatePayroll(@Param('id') id: string, @Body() dto: UpdatePayrollDto) {
        return this.payrollService.update(id, dto);
    }

    @Delete('payroll/:id')
    deletePayroll(@Param('id') id: string) {
        return this.payrollService.remove(id);
    }

    @Get('payroll/:id/pdf')
    async getPayrollPdf(@Param('id') id: string) {
        const relativeUrl = await this.payrollService.getGeneratedPdf(id);
        return { url: relativeUrl };
    }

    @Post('employees/:id/advance')
    recordAdvance(
        @Param('id') id: string,
        @Body() body: { amount: number, mode: string, centreId: string, userId: string }
    ) {
        return this.payrollService.recordAdvance(id, body.amount, body.mode, body.centreId, body.userId);
    }

    @Get('employees/:id/advances')
    getEmployeeAdvances(@Param('id') id: string) {
        return this.payrollService.getEmployeeAdvances(id);
    }

    @Get('dashboard/stats')
    getDashboardStats(
        @Query('mois') mois?: string,
        @Query('annee') annee?: string,
        @Query('centreId') centreId?: string
    ) {
        return this.payrollService.getDashboardStats(mois, annee ? parseInt(annee) : undefined, centreId);
    }
}
