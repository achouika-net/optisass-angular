import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@Injectable()
export class AttendanceService {
    constructor(private prisma: PrismaService) { }

    async log(createAttendanceDto: CreateAttendanceDto) {
        return this.prisma.attendance.create({
            data: {
                ...createAttendanceDto,
                date: new Date(createAttendanceDto.date)
            }
        });
    }

    async getEmployeeMonthly(employeeId: string, month: string, year: number) {
        const startDate = new Date(year, parseInt(month) - 1, 1);
        const endDate = new Date(year, parseInt(month), 0);

        return this.prisma.attendance.findMany({
            where: {
                employeeId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { date: 'asc' }
        });
    }

    async getStats(employeeId: string, month: string, year: number) {
        const attendances = await this.getEmployeeMonthly(employeeId, month, year);

        const totalHours = attendances.reduce((acc, curr) => acc + curr.heuresTravaillees, 0);
        const totalLateMinutes = attendances.reduce((acc, curr) => acc + curr.retardMinutes, 0);
        const absencesCount = attendances.filter(a => a.estAbsent).length;

        return {
            totalHours,
            totalLateMinutes,
            absencesCount,
            attendancesCount: attendances.length
        };
    }
}
