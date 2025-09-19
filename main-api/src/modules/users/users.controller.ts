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
import { UpdateUserDto, UpdateUserSettingsDto } from './dto/update-user.dto';
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
    const { answers } = promptAnswersDto;

    // Validate that 3 prompts are answered (as required by specifications)
    if (answers.length !== 3) {
      throw new BadRequestException('Exactly 3 prompt answers are required');
    }

    const profile = await this.profileRepository.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    try {
      // Delete existing prompt answers
      await this.promptAnswerRepository.delete({ profileId: profile.id });

      // Create new prompt answers
      const answerEntities = answers.map((answer, index) => {
        return this.promptAnswerRepository.create({
          profileId: profile.id,
          promptId: answer.promptId,
          answer: answer.answer,
          order: index + 1, // Set order field which is required by the entity
        });
      });

      await this.promptAnswerRepository.save(answerEntities);

      return {
        success: true,
        message: 'Prompt answers submitted successfully',
      };
    } catch (error) {
      // Log the error for debugging
      console.error(
        'Error saving prompt answers for user',
        user.id,
        ':',
        error,
      );
      throw new BadRequestException(
        'Failed to save prompt answers: ' + error.message,
      );
    }
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
}
