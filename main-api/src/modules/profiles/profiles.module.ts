import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { StorageService } from '../../common/services/storage.service';

import { ProfilesController } from './profiles.controller';
import { PersonalityController } from './personality.controller';
import { ProfilesService } from './profiles.service';
import { DatabaseSeederService } from './database-seeder.service';
import { ProfileCompletionGuard } from '../auth/guards/profile-completion.guard';
import { ModerationModule } from '../moderation/moderation.module';

import { Profile } from '../../database/entities/profile.entity';
import { User } from '../../database/entities/user.entity';
import { PersonalityQuestion } from '../../database/entities/personality-question.entity';
import { PersonalityAnswer } from '../../database/entities/personality-answer.entity';
import { Photo } from '../../database/entities/photo.entity';
import { Prompt } from '../../database/entities/prompt.entity';
import { PromptAnswer } from '../../database/entities/prompt-answer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Profile,
      User,
      PersonalityQuestion,
      PersonalityAnswer,
      Photo,
      Prompt,
      PromptAnswer,
    ]),
    ModerationModule,
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        storage: memoryStorage(),
        fileFilter: (req, file, callback) => {
          const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
          if (validMimeTypes.includes(file.mimetype.toLowerCase())) {
            callback(null, true);
            return;
          }
          if (file.mimetype === 'application/octet-stream' && file.originalname) {
            const ext = file.originalname.split('.').pop()?.toLowerCase();
            if (ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
              callback(null, true);
              return;
            }
          }
          callback(
            new Error(`Only image files (JPEG, PNG, WebP) are allowed! Received: ${file.mimetype}`),
            false,
          );
        },
        limits: {
          fileSize: parseInt(configService.get('fileUpload.maxFileSize') || '5242880', 10),
          files: 6,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ProfilesService, DatabaseSeederService, ProfileCompletionGuard, StorageService],
  controllers: [ProfilesController, PersonalityController],
  exports: [ProfilesService, ProfileCompletionGuard],
})
export class ProfilesModule {}
