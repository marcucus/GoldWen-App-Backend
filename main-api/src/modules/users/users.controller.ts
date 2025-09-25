import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Req,
  Delete,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';

import { UsersService } from './users.service';
import { ProfilesService } from '../profiles/profiles.service';
import { UpdateUserDto, UpdateUserSettingsDto } from './dto/update-user.dto';
import { RegisterPushTokenDto, DeletePushTokenDto } from './dto/push-token.dto';
import { SuccessResponseDto } from '../../common/dto/response.dto';
import { User } from '../../database/entities/user.entity';
import { Profile } from '../../database/entities/profile.entity';
import { PromptAnswer } from '../../database/entities/prompt-answer.entity';
import { SubmitPromptAnswersDto } from '../profiles/dto/profiles.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private profilesService: ProfilesService,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(PromptAnswer)
    private promptAnswerRepository: Repository<PromptAnswer>,
  ) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @Get('me')
  async getMyProfile(@Req() req: Request) {
    const user = req.user as User;
    const userProfile = await this.usersService.findById(user.id);

    return {
      success: true,
      data: {
        id: userProfile.id,
        email: userProfile.email,
        status: userProfile.status,
        isEmailVerified: userProfile.isEmailVerified,
        isOnboardingCompleted: userProfile.isOnboardingCompleted,
        isProfileCompleted: userProfile.isProfileCompleted,
        notificationsEnabled: userProfile.notificationsEnabled,
        lastLoginAt: userProfile.lastLoginAt,
        createdAt: userProfile.createdAt,
        profile: userProfile.profile,
      },
    };
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated' })
  @Put('me')
  async updateMyProfile(
    @Req() req: Request,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = req.user as User;
    const updatedUser = await this.usersService.updateUser(
      user.id,
      updateUserDto,
    );

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        profile: updatedUser.profile,
      },
    };
  }

  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  @Put('me/settings')
  async updateSettings(
    @Req() req: Request,
    @Body() settingsDto: UpdateUserSettingsDto,
  ) {
    const user = req.user as User;
    await this.usersService.updateSettings(user.id, settingsDto);

    return new SuccessResponseDto('Settings updated successfully');
  }

  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'User statistics retrieved' })
  @Get('me/stats')
  async getUserStats(@Req() req: Request) {
    const user = req.user as User;
    const stats = await this.usersService.getUserStats(user.id);

    return {
      success: true,
      data: stats,
    };
  }

  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  @Put('me/deactivate')
  async deactivateAccount(@Req() req: Request) {
    const user = req.user as User;
    await this.usersService.deactivateUser(user.id);

    return new SuccessResponseDto('Account deactivated successfully');
  }

  @ApiOperation({ summary: 'Submit user prompt answers' })
  @ApiResponse({
    status: 201,
    description: 'Prompt answers submitted successfully',
  })
  @Post('me/prompts')
  async submitPrompts(
    @Req() req: Request,
    @Body() promptAnswersDto: SubmitPromptAnswersDto,
  ) {
    const user = req.user as User;
    
    // Delegate to ProfilesService which now handles dynamic validation
    await this.profilesService.submitPromptAnswers(user.id, promptAnswersDto);

    return {
      success: true,
      message: 'Prompt answers submitted successfully',
    };
  }

  @ApiOperation({ summary: 'Get user prompt answers' })
  @ApiResponse({
    status: 200,
    description: 'User prompt answers retrieved successfully',
  })
  @Get('me/prompts')
  async getUserPrompts(@Req() req: Request) {
    const user = req.user as User;
    return this.profilesService.getUserPromptAnswers(user.id);
  }

  @ApiOperation({ summary: 'Upload user photos' })
  @ApiResponse({ status: 201, description: 'Photos uploaded successfully' })
  @Post('me/photos')
  async uploadPhotos(@Req() req: Request) {
    const user = req.user as User;

    // For now, return a response indicating the endpoint structure is ready
    // In a full implementation, this would handle multipart/form-data file uploads
    return {
      success: true,
      message:
        'Photo upload endpoint ready - requires multipart/form-data implementation',
      data: {
        userId: user.id,
        maxPhotos: 6,
        supportedFormats: ['jpg', 'jpeg', 'png'],
        maxFileSize: '10MB',
      },
    };
  }

  @ApiOperation({ summary: 'Delete user photo' })
  @ApiResponse({ status: 200, description: 'Photo deleted successfully' })
  @Delete('me/photos/:photoId')
  async deletePhoto(@Req() req: Request) {
    const user = req.user as User;
    // const photoId = req.params.photoId; // Would extract from params

    // For now, return a response indicating the endpoint structure is ready
    return {
      success: true,
      message:
        'Photo deletion endpoint ready - requires photo ID parameter handling',
      data: {
        userId: user.id,
      },
    };
  }

  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @Delete('me')
  async deleteAccount(@Req() req: Request) {
    const user = req.user as User;
    await this.usersService.deleteUser(user.id);

    return new SuccessResponseDto('Account deleted successfully');
  }

  @ApiOperation({ summary: 'Register device push token' })
  @ApiResponse({
    status: 201,
    description: 'Push token registered successfully',
  })
  @Post('me/push-tokens')
  async registerPushToken(
    @Req() req: Request,
    @Body() registerPushTokenDto: RegisterPushTokenDto,
  ) {
    const user = req.user as User;
    const pushToken = await this.usersService.registerPushToken(
      user.id,
      registerPushTokenDto,
    );

    return {
      success: true,
      message: 'Push token registered successfully',
      data: {
        id: pushToken.id,
        platform: pushToken.platform,
        createdAt: pushToken.createdAt,
      },
    };
  }

  @ApiOperation({ summary: 'Delete device push token' })
  @ApiResponse({ status: 200, description: 'Push token deleted successfully' })
  @Delete('me/push-tokens')
  async deletePushToken(
    @Req() req: Request,
    @Body() deletePushTokenDto: DeletePushTokenDto,
  ) {
    const user = req.user as User;
    await this.usersService.deletePushToken(user.id, deletePushTokenDto.token);

    return {
      success: true,
      message: 'Push token deleted successfully',
    };
  }
}
