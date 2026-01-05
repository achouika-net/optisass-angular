import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { PersonnelService } from './personnel.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { CommissionService } from './commission.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';

@Controller('personnel')
export class PersonnelController {
    constructor(
        private readonly personnelService: PersonnelService,
        private readonly attendanceService: AttendanceService,
        private readonly commissionService: CommissionService,
        private readonly payrollService: PayrollService,
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

    @Get('commissions/:employeeId')
    getEmployeeCommissions(
        @Param('employeeId') employeeId: string,
        @Query('mois') mois: string,
    ) {
        return this.commissionService.getEmployeeCommissions(employeeId, mois);
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
        @Body('centreId') centreId: string,
        @Body('userId') userId: string,
    ) {
        return this.payrollService.markAsPaid(id, centreId, userId);
    }

    @Get('payroll')
    findAllPayroll(
        @Query('mois') mois?: string,
        @Query('annee') annee?: string,
        @Query('centreId') centreId?: string,
    ) {
        return this.payrollService.findAll(mois, annee ? parseInt(annee) : undefined, centreId);
    }
}
