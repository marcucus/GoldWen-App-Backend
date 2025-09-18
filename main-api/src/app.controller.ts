import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { CustomLoggerService } from './common/logger';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ProfilesService } from './modules/profiles/profiles.service';
import { SubmitPersonalityAnswersDto } from './modules/profiles/dto/profiles.dto';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly logger: CustomLoggerService,
    private readonly profilesService: ProfilesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'API Welcome message' })
  @ApiResponse({ status: 200, description: 'Welcome message' })
  getHello(): string {
    this.logger.info('Welcome endpoint accessed');
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service health status' })
  getHealth() {
    const healthData = this.appService.getHealth();

    this.logger.info('Health check requested', {
      status: healthData.status,
      uptime: healthData.uptime,
    });

    return healthData;
  }

  // Root-level routes as specified in the issue
  @Get('personality-questions')
  @ApiOperation({ summary: 'Get personality questionnaire questions' })
  @ApiResponse({ status: 200, description: 'Personality questions retrieved' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPersonalityQuestions() {
    return this.profilesService.getPersonalityQuestions();
  }

  @Post('personality-answers')
  @ApiOperation({ summary: 'Submit personality questionnaire answers' })
  @ApiResponse({
    status: 201,
    description: 'Personality answers submitted successfully',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async submitPersonalityAnswers(
    @Request() req: any,
    @Body() answersDto: SubmitPersonalityAnswersDto,
  ) {
    await this.profilesService.submitPersonalityAnswers(
      req.user.id,
      answersDto,
    );
    return { message: 'Personality answers submitted successfully' };
  }
}
