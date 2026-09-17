import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from '../../database/entities/feedback.entity';
import { FeedbackController } from './feedback.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
@Module({ imports: [TypeOrmModule.forFeature([Feedback]), AuthModule, AdminModule], controllers: [FeedbackController] })
export class FeedbackModule {}
