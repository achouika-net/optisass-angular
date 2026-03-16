import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async sendMailWithAttachment(options: {
    to: string;
    cc?: string;
    replyTo?: string;
    fromName?: string;
    subject: string;
    text: string;
    attachmentName: string;
    attachmentBuffer: Buffer;
  }) {
    const config = await this.prisma.marketingConfig.findFirst();

    let host = config?.smtpHost || this.configService.get<string>('SMTP_HOST');
    let user = config?.smtpUser || this.configService.get<string>('SMTP_USER');
    let pass = config?.smtpPass || this.configService.get<string>('SMTP_PASS');
    let port = Number(config?.smtpPort) || this.configService.get<number>('SMTP_PORT', 587);
    let secure = port === 465;

    if (!host || !user || !pass) {
      this.logger.warn('[Mailer] SMTP credentials missing. Using Ethereal Email for testing purposes.');
      const testAccount = await nodemailer.createTestAccount();
      host = testAccount.smtp.host;
      port = testAccount.smtp.port;
      secure = testAccount.smtp.secure;
      user = testAccount.user;
      pass = testAccount.pass;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
      from: options.fromName ? `"${options.fromName}" <${config?.smtpFrom || this.configService.get<string>('SMTP_FROM', user)}>` : (config?.smtpFrom || this.configService.get<string>('SMTP_FROM', user)),
      to: options.to,
      cc: options.cc,
      replyTo: options.replyTo,
      subject: options.subject,
      text: options.text,
      html: `<div style="font-family: sans-serif; padding: 20px;">
              ${options.text.replace(/\n/g, '<br>')}
             </div>`,
      attachments: [
        {
          filename: options.attachmentName,
          content: options.attachmentBuffer,
        },
      ],
    });

    this.logger.log(`[Mailer] Email sent to ${options.to}: ${info.messageId}`);
    if (info.messageId && nodemailer.getTestMessageUrl(info)) {
      this.logger.log(`[Mailer] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return info;
  }
}
