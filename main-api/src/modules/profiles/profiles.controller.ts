import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfilesService } from './profiles.service';
import {
  UpdateProfileDto,
  SubmitPersonalityAnswersDto,
  UploadPhotosDto,
  SubmitPromptAnswersDto,
} from './dto/profiles.dto';

@ApiTags('profiles')
@Controller('profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@Request() req: any) {
    return this.profilesService.getProfile(req.user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(@Request() req: any, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profilesService.updateProfile(req.user.id, updateProfileDto);
  }

  @Get('completion')
  @ApiOperation({ summary: 'Get profile completion status' })
  @ApiResponse({ status: 200, description: 'Profile completion status' })
  async getProfileCompletion(@Request() req: any) {
    return this.profilesService.getProfileCompletion(req.user.id);
  }

  @Get('personality-questions')
  @ApiOperation({ summary: 'Get personality questionnaire questions' })
  @ApiResponse({ status: 200, description: 'Personality questions retrieved' })
  async getPersonalityQuestions() {
    return this.profilesService.getPersonalityQuestions();
  }

  @Post('personality-answers')
  @ApiOperation({ summary: 'Submit personality questionnaire answers' })
  @ApiResponse({ status: 201, description: 'Personality answers submitted successfully' })
  async submitPersonalityAnswers(
    @Request() req: any,
    @Body() answersDto: SubmitPersonalityAnswersDto,
  ) {
    await this.profilesService.submitPersonalityAnswers(req.user.id, answersDto);
    return { message: 'Personality answers submitted successfully' };
  }

  @Post('photos')
  @ApiOperation({ summary: 'Upload profile photos' })
  @ApiResponse({ status: 201, description: 'Photos uploaded successfully' })
  async uploadPhotos(@Request() req: any, @Body() photosDto: UploadPhotosDto) {
    return this.profilesService.uploadPhotos(req.user.id, photosDto);
  }

  @Delete('photos/:photoId')
  @ApiOperation({ summary: 'Delete a profile photo' })
  @ApiResponse({ status: 200, description: 'Photo deleted successfully' })
  async deletePhoto(@Request() req: any, @Param('photoId') photoId: string) {
    await this.profilesService.deletePhoto(req.user.id, photoId);
    return { message: 'Photo deleted successfully' };
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Get available prompts' })
  @ApiResponse({ status: 200, description: 'Prompts retrieved successfully' })
  async getPrompts() {
    return this.profilesService.getPrompts();
  }

  @Post('prompt-answers')
  @ApiOperation({ summary: 'Submit prompt answers' })
  @ApiResponse({ status: 201, description: 'Prompt answers submitted successfully' })
  async submitPromptAnswers(
    @Request() req: any,
    @Body() promptAnswersDto: SubmitPromptAnswersDto,
  ) {
    await this.profilesService.submitPromptAnswers(req.user.id, promptAnswersDto);
    return { message: 'Prompt answers submitted successfully' };
  }
}