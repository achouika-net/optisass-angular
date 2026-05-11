import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import compression = require('compression'); // Triggering re-compilation for Docker synchronization
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global prefix for all routes to match frontend config
  app.setGlobalPrefix('api');

  // Security: Use Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'", 'https:'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      xssFilter: true,
    }),
  );

  // Set the limit for incoming JSON and URL-encoded data to support large imports
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Enable Gzip compression to significantly reduce network payload size
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      exceptionFactory: (errors) => {
        console.error('❌ Validation Errors:', JSON.stringify(errors, null, 2));
        return new BadRequestException(errors);
      },
    }),
  );

  // Strict CORS: Only allow specific origins
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:4200',
    'https://optisaas.pro',
    'https://www.optisaas.pro',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    maxAge: 3600,
  });

  const port = process.env.PORT ?? 3000;

  // LOG STARTUP TO FILE TO BE 100% SURE
  const fs = require('fs');
  const logFile = 'server.log';
  fs.appendFileSync(
    logFile,
    `\n--- SERVER STARTUP: ${new Date().toISOString()} --- VERSION 3.0 (SECURITY HARDENED) ---\n`,
  );

  // Redirect console to file
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = (...args) => {
    fs.appendFileSync(
      logFile,
      `[LOG] ${new Date().toISOString()}: ${args.join(' ')}\n`,
    );
    originalConsoleLog.apply(console, args);
  };

  console.error = (...args) => {
    fs.appendFileSync(
      logFile,
      `[ERROR] ${new Date().toISOString()}: ${args.join(' ')}\n`,
    );
    originalConsoleError.apply(console, args);
  };

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   🚀 OptiSaas ERP - Version 3.0 (Security Hardened)  ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║   Port: ${port}${' '.repeat(50 - `Port: ${port}`.length)}║`);
  console.log(
    `║   Environment: ${process.env.NODE_ENV || 'development'}${' '.repeat(43 - `Environment: ${process.env.NODE_ENV || 'development'}`.length)}║`,
  );
  console.log('║   Security: Helmet + JWT + Rate Limit + Audit Log     ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');

  await app.listen(port, '0.0.0.0');
}
bootstrap();
