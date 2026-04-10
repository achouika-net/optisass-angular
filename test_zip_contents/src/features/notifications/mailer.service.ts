import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  
  // [FIX 3] Cached SMTP transporter — reuse TCP+TLS connection
  private cachedTransporter: nodemailer.Transporter | null = null;
  private cachedTransporterKey: string = '';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * [FIX 3] Get or create a cached SMTP transporter.
   * The transporter is invalidated when the config key (host:port:user) changes.
   */
  private getOrCreateTransporter(host: string, port: number, secure: boolean, user: string, pass: string): nodemailer.Transporter {
    const configKey = `${host}:${port}:${user}`;
    
    if (this.cachedTransporter && this.cachedTransporterKey === configKey) {
      this.logger.debug('[Mailer] Reusing cached SMTP transporter');
      return this.cachedTransporter;
    }

    this.logger.log(`[Mailer] Creating new SMTP transporter for ${host}:${port}`);
    this.cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      // Connection pooling for multiple emails
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
    });
    this.cachedTransporterKey = configKey;
    
    return this.cachedTransporter;
  }

  async sendMailWithAttachment(options: {
    to: string;
    cc?: string;
    replyTo?: string;
    fromName?: string;
    subject: string;
    text: string;
    attachments: Array<{ filename: string; content: Buffer }>;
  }) {
    const config = await this.prisma.marketingConfig.findFirst();

    const host = config?.smtpHost || this.configService.get<string>('SMTP_HOST');
    const user = config?.smtpUser || this.configService.get<string>('SMTP_USER');
    const pass = config?.smtpPass || this.configService.get<string>('SMTP_PASS');
    const port = Number(config?.smtpPort) || this.configService.get<number>('SMTP_PORT', 587);
    const secure = port === 465;

    // [FIX 4] Removed Ethereal fallback — throw clear error instead of silently adding 3s latency
    if (!host || !user || !pass) {
      this.logger.error('[Mailer] SMTP credentials missing! Configure SMTP settings in Marketing Config.');
      throw new BadRequestException(
        'Configuration SMTP manquante. Veuillez configurer les paramètres SMTP dans Paramètres > Marketing.'
      );
    }

    // [FIX 3] Reuse cached transporter
    const transporter = this.getOrCreateTransporter(host, port, secure, user, pass);

    // IMPROVEMENT: Enforce valid 'from' address structure. 
    // Gmail/Outlook often reject if the email part of 'from' doesn't match the authenticated user.
    const fromEmail = (config?.smtpFrom && config.smtpFrom.includes('@')) 
      ? config.smtpFrom 
      : (this.configService.get<string>('SMTP_FROM') || user);
    
    // Display name logic: Prefer centreName (options.fromName), then config name (if not email), then center name
    const displayName = options.fromName || (config?.smtpFrom && !config.smtpFrom.includes('@') ? config.smtpFrom : undefined);
    const finalFrom = displayName ? `"${displayName}" <${fromEmail}>` : fromEmail;

    const info = await transporter.sendMail({
      from: finalFrom,
      to: options.to,
      cc: options.cc,
      replyTo: options.replyTo,
      subject: options.subject,
      text: options.text,
      html: `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
              ${(options.text || '').replace(/\n/g, '<br>')}
             </div>`,
      attachments: options.attachments,
    });

    this.logger.log(`[Mailer] Email sent to ${options.to}: ${info.messageId}`);
    return info;
  }
}
