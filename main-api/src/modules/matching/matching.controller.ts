import type { Request as ExpressRequest } from 'express';
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfileCompletionGuard } from '../auth/guards/profile-completion.guard';
import { PremiumGuard } from '../auth/guards/premium.guard';
import { QuotaGuard } from './guards/quota.guard';
import { DevOnlyGuard } from '../../common/guards';
import { MatchingService } from './matching.service';
import { GetMatchesDto } from './dto/matching.dto';
import { User } from '../../database/entities/user.entity';

@ApiTags('matching')
@Controller('matching')
@UseGuards(JwtAuthGuard, ProfileCompletionGuard)
@ApiBearerAuth()
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('user-choices')
  @ApiOperation({ summary: 'Get user choices history' })
  @ApiResponse({
    status: 200,
    description: 'User choices retrieved successfully',
  })
  async getUserChoices(
    @Request() req: ExpressRequest,
    @Query('date') date?: string,
  ) {
    const data = await this.matchingService.getUserChoices(
      (req.user as User).id,
      date,
    );
    return {
      success: true,
      data,
    };
  }

  @Get('daily-selection/status')
  @ApiOperation({ summary: 'Get daily selection status' })
  @ApiResponse({
    status: 200,
    description: 'Daily selection status retrieved successfully',
  })
  async getDailySelectionStatus(@Request() req: ExpressRequest) {
    return this.matchingService.getDailySelectionStatus((req.user as User).id);
  }

  @Get('daily-selection')
  @ApiOperation({ summary: 'Get daily selection of profiles' })
  @ApiResponse({
    status: 200,
    description: 'Daily selection retrieved successfully',
  })
  async getDailySelection(
    @Request() req: ExpressRequest,
    @Query('preload') preload?: boolean,
  ) {
    const data = await this.matchingService.getDailySelection(
      (req.user as User).id,
      preload,
    );
    return {
      success: true,
      data,
    };
  }

  // SECURITY (Phase 0.6): unguarded, this let any user force-regenerate
  // their own daily selection on demand — bypassing the once-a-day cadence
  // that "un choix/jour" (or 3/jour on GoldWen Plus) depends on. DevOnlyGuard
  // restricts it to non-production environments; it was already documented
  // as "for testing" and was never meant to be reachable in production.
  @Post('daily-selection/generate')
  @UseGuards(DevOnlyGuard)
  @ApiOperation({
    summary: 'Manually generate daily selection (dev/testing only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Daily selection generated successfully',
  })
  @ApiResponse({ status: 403, description: 'Not available in production' })
  async generateDailySelection(@Request() req: ExpressRequest) {
    return this.matchingService.generateDailySelection((req.user as User).id);
  }

  @Post('choose/:targetUserId')
  @UseGuards(QuotaGuard)
  @ApiOperation({ summary: 'Choose a profile from daily selection' })
  @ApiResponse({
    status: 201,
    description: 'Profile choice registered successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Daily quota exceeded',
  })
  async chooseProfile(
    @Request() req: ExpressRequest,
    @Param('targetUserId') targetUserId: string,
    @Body() body: { choice: 'like' | 'pass' },
  ) {
    return this.matchingService.chooseProfile(
      (req.user as User).id,
      targetUserId,
      body.choice,
    );
  }

  @Get('matches')
  @ApiOperation({ summary: 'Get user matches' })
  @ApiResponse({ status: 200, description: 'Matches retrieved successfully' })
  async getMatches(
    @Request() req: ExpressRequest,
    @Query() query: GetMatchesDto,
  ) {
    const matches = await this.matchingService.getUserMatches(
      (req.user as User).id,
      query.status,
    );
    return {
      success: true,
      data: matches,
    };
  }

  @Get('pending-matches')
  @ApiOperation({ summary: 'Get pending matches awaiting chat acceptance' })
  @ApiResponse({
    status: 200,
    description: 'Pending matches retrieved successfully',
  })
  async getPendingMatches(@Request() req: ExpressRequest) {
    const pendingMatches = await this.matchingService.getPendingMatches(
      (req.user as User).id,
    );
    return {
      success: true,
      data: pendingMatches,
    };
  }

  @Get('matches/:matchId')
  @ApiOperation({ summary: 'Get specific match details' })
  @ApiResponse({
    status: 200,
    description: 'Match details retrieved successfully',
  })
  async getMatch(
    @Request() req: ExpressRequest,
    @Param('matchId') matchId: string,
  ) {
    const matches = await this.matchingService.getUserMatches(
      (req.user as User).id,
    );
    const match = matches.find((m) => m.id === matchId);

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  @Delete('matches/:matchId')
  @ApiOperation({ summary: 'Delete a match' })
  @ApiResponse({ status: 200, description: 'Match deleted successfully' })
  async deleteMatch(
    @Request() req: ExpressRequest,
    @Param('matchId') matchId: string,
  ) {
    await this.matchingService.deleteMatch((req.user as User).id, matchId);
    return { message: 'Match deleted successfully' };
  }

  @Get('compatibility/:targetUserId')
  @ApiOperation({ summary: 'Get compatibility score with another user' })
  @ApiResponse({ status: 200, description: 'Compatibility score calculated' })
  async getCompatibilityScore(
    @Request() req: ExpressRequest,
    @Param('targetUserId') targetUserId: string,
  ) {
    const score = await this.matchingService.getCompatibilityScore(
      (req.user as User).id,
      targetUserId,
    );
    return { compatibilityScore: score };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get matching history' })
  @ApiResponse({
    status: 200,
    description: 'Matching history retrieved successfully',
  })
  async getMatchingHistory(
    @Request() req: ExpressRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    return this.matchingService.getHistory((req.user as User).id, options);
  }

  @Get('who-liked-me')
  @UseGuards(PremiumGuard)
  @ApiOperation({
    summary: 'Get users who liked me (Premium feature)',
  })
  @ApiResponse({
    status: 200,
    description: 'Users who liked me retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Premium subscription required',
  })
  async getWhoLikedMe(@Request() req: ExpressRequest) {
    const likedBy = await this.matchingService.getWhoLikedMe(
      (req.user as User).id,
    );
    return {
      success: true,
      data: likedBy,
    };
  }
}
