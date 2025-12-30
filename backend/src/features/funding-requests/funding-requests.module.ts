import { Module } from '@nestjs/common';
import { FundingRequestsService } from './funding-requests.service';
import { FundingRequestsController } from './funding-requests.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FundingRequestsController],
    providers: [FundingRequestsService],
    exports: [FundingRequestsService],
})
export class FundingRequestsModule { }
