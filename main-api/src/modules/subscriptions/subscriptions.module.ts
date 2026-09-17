import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { RevenueCatController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';
import { AdminGuard } from '../auth/guards/admin.guard';

import { Subscription } from '../../database/entities/subscription.entity';
import { User } from '../../database/entities/user.entity';
import { DailySelection } from '../../database/entities/daily-selection.entity';
import { Admin } from '../../database/entities/admin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, User, DailySelection, Admin]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [SubscriptionsService, RevenueCatService, AdminGuard],
  controllers: [SubscriptionsController, RevenueCatController],
  exports: [SubscriptionsService, RevenueCatService],
})
export class SubscriptionsModule {}
