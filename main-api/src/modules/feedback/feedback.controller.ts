import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SkipProfileCompletion } from '../auth/decorators/skip-profile-completion.decorator';
import { Feedback } from '../../database/entities/feedback.entity';
import { User } from '../../database/entities/user.entity';
import { CreateFeedbackDto } from './feedback.dto';
@ApiTags('Feedback')
@ApiBearerAuth()
@Controller('feedback')
export class FeedbackController {
  constructor(
    @InjectRepository(Feedback)
    private readonly repository: Repository<Feedback>,
  ) {}
  @Post()
  @UseGuards(JwtAuthGuard)
  @SkipProfileCompletion()
  @ApiOperation({ summary: 'Submit feedback or a support request' })
  async create(@Req() req: Request, @Body() dto: CreateFeedbackDto) {
    const feedback = await this.repository.save(
      this.repository.create({ ...dto, userId: (req.user as User).id }),
    );
    return {
      success: true,
      data: { id: feedback.id, createdAt: feedback.createdAt },
    };
  }
  @Get('admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Read the latest 100 feedback submissions (admin)' })
  async list() {
    return {
      success: true,
      data: await this.repository.find({
        order: { createdAt: 'DESC' },
        take: 100,
      }),
    };
  }
}
