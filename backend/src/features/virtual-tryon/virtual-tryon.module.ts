import { Module } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { VirtualTryonService } from './virtual-tryon.service';
import { VirtualTryonController } from './virtual-tryon.controller';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
    imports: [CacheModule.register()],
    providers: [VirtualTryonService, PrismaService],
    controllers: [VirtualTryonController],
    exports: [VirtualTryonService],
})
export class VirtualTryonModule { }
