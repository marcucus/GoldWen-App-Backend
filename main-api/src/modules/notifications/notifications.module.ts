import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RoleGuard } from '../auth/guards/role.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { FirebaseService } from './firebase.service';
import { FcmService } from './fcm.service';
import { ScheduledNotificationsService } from './scheduled-notifications.service';
import { Notification } from '../../database/entities/notification.entity';
import { NotificationPreferences } from '../../database/entities/notification-preferences.entity';
import { User } from '../../database/entities/user.entity';
import { PushToken } from '../../database/entities/push-token.entity';
import { DailySelection } from '../../database/entities/daily-selection.entity';
import { Chat } from '../../database/entities/chat.entity';
import { Admin } from '../../database/entities/admin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreferences,
      User,
      PushToken,
      DailySelection,
      Chat,
      Admin,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    NotificationsService,
    FirebaseService,
    FcmService,
    ScheduledNotificationsService,
    RoleGuard,
    AdminGuard,
    Reflector,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, FirebaseService, FcmService],
})
export class NotificationsModule {}
