import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('diag')
export class DiagController {
  constructor(private prisma: PrismaService) {}

  @Get('data-check')
  async checkData() {
    const [paymentCount, paymentSum, invoiceCount, invoiceSum] =
      await Promise.all([
        this.prisma.paiement.count(),
        this.prisma.paiement.aggregate({ _sum: { montant: true } }),
        this.prisma.facture.count(),
        this.prisma.facture.aggregate({ _sum: { totalHT: true } }),
      ]);

    return {
      payments: { count: paymentCount, sum: paymentSum._sum.montant },
      invoices: { count: invoiceCount, sum: invoiceSum._sum.totalHT },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('glass-test')
  async testGlass() {
    return { status: 'OK', message: 'DiagController can see you' };
  }
}
