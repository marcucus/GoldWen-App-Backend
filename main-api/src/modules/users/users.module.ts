import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../database/entities/user.entity';
import { Profile } from '../../database/entities/profile.entity';
import { Match } from '../../database/entities/match.entity';
import { Message } from '../../database/entities/message.entity';
import { Subscription } from '../../database/entities/subscription.entity';
import { DailySelection } from '../../database/entities/daily-selection.entity';
import { PromptAnswer } from '../../database/entities/prompt-answer.entity';
import { Prompt } from '../../database/entities/prompt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Match,
      Message,
      Subscription,
      DailySelection,
      PromptAnswer,
      Prompt,
    ]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
