import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './common/config/app.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { DatabaseModule } from './modules/db/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { DeliveryModule } from './modules/delivery/delivery.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { ProductsModule } from './modules/products/products.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    ChatModule,
    DeliveryModule,
  ],
})
export class AppModule {}
