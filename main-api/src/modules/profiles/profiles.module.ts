import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { DatabaseSeederService } from './database-seeder.service';

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
  ],
  providers: [ProfilesService, DatabaseSeederService],
  controllers: [ProfilesController],
  exports: [ProfilesService],
})
export class ProfilesModule {}
