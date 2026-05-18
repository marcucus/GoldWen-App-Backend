import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModerationService } from './services/moderation.service';
import {
  ModerateTextDto,
  ModerateTextBatchDto,
  PhotoModerationStatusDto,
  PhotoModerationWebhookDto,
} from './dto/moderation.dto';

@ApiTags('moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('webhook/photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Photo moderation webhook (internal — called after upload)' })
  @ApiResponse({ status: 200, description: 'Photo moderation result' })
  async photoModerationWebhook(@Body() dto: PhotoModerationWebhookDto) {
    const result = await this.moderationService.moderatePhoto(dto.photoId);
    return {
      success: true,
      data: result,
    };
  }

  @Get('photo/:photoId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get moderation status of a photo' })
  @ApiParam({ name: 'photoId', description: 'Photo ID' })
  @ApiResponse({ status: 200, description: 'Moderation status' })
  async getPhotoStatus(@Param('photoId') photoId: string) {
    const status =
      await this.moderationService.getPhotoModerationStatus(photoId);
    return {
      success: true,
      data: status,
    };
  }

  @Post('admin/photo/:photoId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually trigger photo moderation (admin)' })
  @ApiParam({ name: 'photoId', description: 'Photo ID' })
  @ApiResponse({ status: 201, description: 'Moderation result' })
  async adminModeratePhoto(@Param('photoId') photoId: string) {
    const result = await this.moderationService.moderatePhoto(photoId);
    return {
      success: true,
      data: result,
    };
  }

  @Post('admin/text')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moderate a text string for policy violations (admin)' })
  @ApiResponse({ status: 201, description: 'Moderation result' })
  async adminModerateText(@Body() dto: ModerateTextDto) {
    const result = await this.moderationService.moderateTextContent(dto.text);
    return {
      success: true,
      data: result,
    };
  }

  @Post('admin/text/batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Batch-moderate multiple text strings (admin)' })
  @ApiResponse({ status: 201, description: 'Array of moderation results' })
  async adminModerateTextBatch(@Body() dto: ModerateTextBatchDto) {
    const results = await this.moderationService.moderateTextContentBatch(
      dto.texts,
    );
    return {
      success: true,
      data: results,
    };
  }
}
