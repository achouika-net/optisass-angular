import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { ValidationPipe, BadRequestException } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes to match frontend config
  app.setGlobalPrefix('api');

  // Set the limit for incoming JSON and URL-encoded data to support profile photos
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => {
      console.error('❌ Validation Errors:', JSON.stringify(errors, null, 2));
      return new BadRequestException(errors);
    },
  }));

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  console.log(`🚀 Server is starting on port ${port} with CORS enabled and 10MB Payload Limit`);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
