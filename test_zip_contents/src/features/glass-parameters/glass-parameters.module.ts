import { Module, OnModuleInit } from '@nestjs/common';
import { GlassParametersService } from './glass-parameters.service';
import { GlassParametersController } from './glass-parameters.controller';

@Module({
  providers: [GlassParametersService],
  controllers: [GlassParametersController],
  exports: [GlassParametersService],
})
export class GlassParametersModule implements OnModuleInit {
  onModuleInit() {
    console.log('🚀 GlassParametersModule initialized!');
  }
}
