import { Module } from '@nestjs/common'; // Force Rebuild 6
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
