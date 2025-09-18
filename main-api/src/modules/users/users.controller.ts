import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  Delete,
  Post,
  UseInterceptors,
  UploadedFiles,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
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
    private profilesService: ProfilesService,
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

  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 200, description: 'User account deleted' })
  @Delete('me')
  async deleteMyProfile(@Req() req: Request) {
    const user = req.user as User;
    await this.usersService.deleteUser(user.id);

    return new SuccessResponseDto('Account deleted successfully');
  }

  @ApiOperation({ summary: 'Upload user photos' })
  @ApiResponse({ status: 201, description: 'Photos uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 6))
  @Post('me/photos')
  async uploadPhotos(
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const user = req.user as User;
    return this.profilesService.uploadPhotos(user.id, files);
  }

  @ApiOperation({ summary: 'Delete a user photo' })
  @ApiResponse({ status: 200, description: 'Photo deleted successfully' })
  @Delete('me/photos/:photoId')
  async deletePhoto(@Req() req: Request, @Param('photoId') photoId: string) {
    const user = req.user as User;
    await this.profilesService.deletePhoto(user.id, photoId);
    return { message: 'Photo deleted successfully' };
  }

  @ApiOperation({ summary: 'Submit user prompts' })
  @ApiResponse({
    status: 201,
    description: 'User prompts submitted successfully',
  })
  @Post('me/prompts')
  async submitPrompts(
    @Req() req: Request,
    @Body() promptAnswersDto: SubmitPromptAnswersDto,
  ) {
    const user = req.user as User;
    await this.profilesService.submitPromptAnswers(user.id, promptAnswersDto);
    return { message: 'Prompts submitted successfully' };
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
}
