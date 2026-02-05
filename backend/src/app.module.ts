import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { existsSync } from 'fs';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ClientsModule } from './features/clients/clients.module';
import { FichesModule } from './features/fiches/fiches.module';
import { FacturesModule } from './features/factures/factures.module';
import { PaiementsModule } from './features/paiements/paiements.module';
import { SalesControlModule } from './features/sales-control/sales-control.module';
import { GroupsModule } from './features/groups/groups.module';
import { CentersModule } from './features/centers/centers.module';
import { WarehousesModule } from './features/warehouses/warehouses.module';
import { StockMovementsModule } from './features/stock-movements/stock-movements.module';
import { UsersModule } from './features/users/users.module';

import { ProductsModule } from './features/products/products.module';
import { LoyaltyModule } from './features/loyalty/loyalty.module';
import { StatsModule } from './features/stats/stats.module';
import { SuppliersModule } from './features/suppliers/suppliers.module';
import { ExpensesModule } from './features/expenses/expenses.module';
import { SupplierInvoicesModule } from './features/supplier-invoices/supplier-invoices.module';
import { TreasuryModule } from './features/treasury/treasury.module';
import { CaisseModule } from './features/caisse/caisse.module';
import { JourneeCaisseModule } from './features/journee-caisse/journee-caisse.module';
import { OperationCaisseModule } from './features/operation-caisse/operation-caisse.module';
import { FundingRequestsModule } from './features/funding-requests/funding-requests.module';
import { MarketingModule } from './features/marketing/marketing.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { PersonnelModule } from './features/personnel/personnel.module';
import { AuthModule } from './features/auth/auth.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AccountingModule } from './features/accounting/accounting.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    GroupsModule,
    CentersModule,
    WarehousesModule,
    ProductsModule,
    StockMovementsModule,
    ClientsModule,
    FacturesModule,
    PaiementsModule,
    FichesModule,
    SalesControlModule,
    UsersModule,
    LoyaltyModule,
    StatsModule,
    SuppliersModule,
    ExpensesModule,
    SupplierInvoicesModule,
    TreasuryModule,
    CaisseModule,
    JourneeCaisseModule,
    OperationCaisseModule,
    FundingRequestsModule,
    MarketingModule,
    PersonnelModule,
    AuthModule,
    AccountingModule,
    ServeStaticModule.forRoot({
      rootPath: existsSync('/app/uploads')
        ? '/app/uploads'
        : join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
