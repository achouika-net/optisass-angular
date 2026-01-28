import { Module } from '@nestjs/common';
import { PersonnelController } from './personnel.controller';
import { PayrollConfigController } from './payroll-config.controller';
import { PersonnelService } from './personnel.service';
import { AttendanceService } from './attendance.service';
import { CommissionService } from './commission.service';
import { PayrollService } from './payroll.service';
import { PayslipService } from './payslip.service';
import { ExpensesModule } from '../expenses/expenses.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule, ExpensesModule],
    controllers: [PersonnelController, PayrollConfigController],
    providers: [
        PersonnelService,
        AttendanceService,
        CommissionService,
        PayrollService,
        PayslipService
    ],
    exports: [PersonnelService, CommissionService]
})
export class PersonnelModule { }
