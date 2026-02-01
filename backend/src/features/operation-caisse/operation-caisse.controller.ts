import { Controller, Get, Post, Body, Param, Delete, Query, Headers } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { OperationCaisseService } from './operation-caisse.service';
import { CreateOperationCaisseDto } from './dto/create-operation-caisse.dto';

@Controller('operation-caisse')
export class OperationCaisseController {
    constructor(
        private readonly operationCaisseService: OperationCaisseService,
        private readonly configService: ConfigService
    ) { }

    @Post()
    create(
        @Body() createOperationDto: CreateOperationCaisseDto,
        @Query('userRole') userRole?: string,
        @Headers('authorization') authHeader?: string
    ) {
        const userId = this.getUserId(authHeader);
        return this.operationCaisseService.create(createOperationDto, userRole, userId);
    }

    @Get('journee/:journeeId')
    findByJournee(
        @Param('journeeId') journeeId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.operationCaisseService.findByJournee(journeeId, startDate, endDate);
    }

    @Get('journee/:journeeId/stats')
    getStatsByJournee(@Param('journeeId') journeeId: string) {
        return this.operationCaisseService.getStatsByJournee(journeeId);
    }

    @Post('transfer')
    transfer(
        @Body() transferDto: {
            amount: number;
            fromJourneeId: string;
            toJourneeId: string;
            utilisateur: string;
        },
        @Headers('authorization') authHeader?: string
    ) {
        const userId = this.getUserId(authHeader);
        return this.operationCaisseService.transfer({ ...transferDto, userId });
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

    @Delete(':id')
    remove(@Param('id') id: string, @Query('userRole') userRole?: string) {
        return this.operationCaisseService.remove(id, userRole);
    }
}
