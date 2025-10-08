import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './services/moderation.service';
import { AiModerationService } from './services/ai-moderation.service';
import { ImageModerationService } from './services/image-moderation.service';
import { Photo } from '../../database/entities/photo.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Photo, User]), NotificationsModule],
  controllers: [ModerationController],
  providers: [ModerationService, AiModerationService, ImageModerationService],
  exports: [ModerationService, AiModerationService, ImageModerationService],
})
export class ModerationModule {}
