import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { ValidationPipe, BadRequestException } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes to match frontend config
  app.setGlobalPrefix('api');

  // Set the limit for incoming JSON and URL-encoded data to support large imports
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: false,
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
  console.log(`🚀 Server version 2.1 (Maximum Inclusive Import) starting on port ${port}`);

  // LOG STARTUP TO FILE TO BE 100% SURE
  const fs = require('fs');
  const logFile = 'import_execute.log';
  fs.appendFileSync(logFile, `\n--- SERVER STARTUP: ${new Date().toISOString()} --- VERSION 2.2 (DIAGNOSTICS ACTIVE) ---\n`);

  // Redirect console to file
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = (...args) => {
    fs.appendFileSync(logFile, `[LOG] ${new Date().toISOString()}: ${args.join(' ')}\n`);
    originalConsoleLog.apply(console, args);
  };

  console.error = (...args) => {
    fs.appendFileSync(logFile, `[ERROR] ${new Date().toISOString()}: ${args.join(' ')}\n`);
    originalConsoleError.apply(console, args);
  };

  await app.listen(port, '0.0.0.0');
}
bootstrap();
