import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { UsersService } from './users.service';
import { UpdateUserDto, UpdateUserSettingsDto } from './dto/update-user.dto';
import { SuccessResponseDto } from '../../common/dto/response.dto';
import { User } from '../../database/entities/user.entity';
import { ProfilesService } from '../profiles/profiles.service';
import { SubmitPromptAnswersDto } from '../profiles/dto/profiles.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private profilesService: ProfilesService
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
  @ApiResponse({ status: 201, description: 'Prompt answers submitted successfully' })
  @Post('me/prompts')
  async submitPrompts(
    @Req() req: Request,
    @Body() promptAnswersDto: SubmitPromptAnswersDto,
  ) {
    const user = req.user as User;
    await this.profilesService.submitPromptAnswers(user.id, promptAnswersDto);
    
    return {
      success: true,
      message: 'Prompt answers submitted successfully'
    };
  }

  @ApiOperation({ summary: 'Upload user photos' })
  @ApiResponse({ status: 201, description: 'Photos uploaded successfully' })
  @Post('me/photos')
  async uploadPhotos(@Req() req: Request) {
    // This endpoint would handle photo uploads
    // For now, return a placeholder response
    return {
      success: true,
      message: 'Photo upload endpoint - implement file handling'
    };
  }

  @ApiOperation({ summary: 'Delete user photo' })
  @ApiResponse({ status: 200, description: 'Photo deleted successfully' })
  @Delete('me/photos/:photoId')
  async deletePhoto(@Req() req: Request) {
    // This endpoint would handle photo deletion
    // For now, return a placeholder response
    return {
      success: true,
      message: 'Photo deletion endpoint - implement photo deletion logic'
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
}
