import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { PdfService } from './pdf.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MailerService, PdfService],
  exports: [MailerService, PdfService],
})
export class NotificationsModule {}
