import { Module } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [LoyaltyController],
    providers: [LoyaltyService],
    exports: [LoyaltyService]
})
export class LoyaltyModule { }
