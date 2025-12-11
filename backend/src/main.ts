import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  console.log('🚀 Server is starting on port 3000 with CORS enabled (Nuclear Mode)');
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
