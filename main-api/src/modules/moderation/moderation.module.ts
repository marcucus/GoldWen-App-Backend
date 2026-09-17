import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './services/moderation.service';
import { AiModerationService } from './services/ai-moderation.service';
import { ImageModerationService } from './services/image-moderation.service';
import { ForbiddenWordsService } from './services/forbidden-words.service';
import { Photo } from '../../database/entities/photo.entity';
import { User } from '../../database/entities/user.entity';
import { Admin } from '../../database/entities/admin.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ModerationWebhookGuard } from './guards/moderation-webhook.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Photo, User, Admin]),
    NotificationsModule,
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
  controllers: [ModerationController],
  providers: [
    ModerationService,
    AiModerationService,
    ImageModerationService,
    ForbiddenWordsService,
    AdminGuard,
    ModerationWebhookGuard,
  ],
  exports: [
    ModerationService,
    AiModerationService,
    ImageModerationService,
    ForbiddenWordsService,
  ],
})
export class ModerationModule {}
