import type { Request as ExpressRequest } from 'express';
import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Roles, RoleGuard } from '../auth/guards/role.guard';
import { UserRole } from '../../common/enums';
import { NotificationsService } from './notifications.service';
import { CustomLoggerService } from '../../common/logger';
import { ScheduledNotificationsService } from './scheduled-notifications.service';

import {
  GetNotificationsDto,
  UpdateNotificationSettingsDto,
  TestNotificationDto,
  SendGroupNotificationDto,
} from './dto/notifications.dto';
import { RegisterPushTokenDto, DeletePushTokenDto } from './dto/push-token.dto';
import { User } from '../../database/entities/user.entity';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly logger: CustomLoggerService,
    private readonly scheduledNotificationsService: ScheduledNotificationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async getNotifications(
    @Request() req: ExpressRequest,
    @Query() getNotificationsDto: GetNotificationsDto,
  ) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const result = await this.notificationsService.getNotifications(
      userId,
      getNotificationsDto,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Put(':notificationId/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @Request() req: ExpressRequest,
    @Param('notificationId') notificationId: string,
  ) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const notification = await this.notificationsService.markAsRead(
      notificationId,
      userId,
    );

    return {
      success: true,
      data: notification,
      message: 'Notification marked as read',
    };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@Request() req: ExpressRequest) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const result = await this.notificationsService.markAllAsRead(userId);

    return {
      success: true,
      data: result,
      message: 'All notifications marked as read',
    };
  }

  @Delete(':notificationId')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  async deleteNotification(
    @Request() req: ExpressRequest,
    @Param('notificationId') notificationId: string,
  ) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    await this.notificationsService.deleteNotification(notificationId, userId);

    return {
      success: true,
      message: 'Notification deleted successfully',
    };
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings retrieved' })
  async getSettings(@Request() req: ExpressRequest) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const settings =
      await this.notificationsService.getNotificationSettings(userId);

    return {
      success: true,
      settings,
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings updated' })
  async updateSettings(
    @Request() req: ExpressRequest,
    @Body() updateSettingsDto: UpdateNotificationSettingsDto,
  ) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const result = await this.notificationsService.updateNotificationSettings(
      userId,
      updateSettingsDto,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Post('test')
  @ApiOperation({
    summary: 'Send test notification (development only)',
    description: 'This endpoint is only available in development environment',
  })
  @ApiResponse({ status: 200, description: 'Test notification sent' })
  @ApiResponse({ status: 403, description: 'Not available in production' })
  async sendTestNotification(
    @Request() req: ExpressRequest,
    @Body() testNotificationDto: TestNotificationDto,
  ) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const notification = await this.notificationsService.sendTestNotification(
      userId,
      testNotificationDto,
    );

    return {
      success: true,
      data: notification,
      message: 'Test notification sent successfully',
    };
  }

  @Post('send-group')
  @Roles([UserRole.ADMIN])
  @UseGuards(RoleGuard)
  @ApiOperation({
    summary: 'Send notification to group of users (admin only)',
    description: 'Send a notification to multiple users at once',
  })
  @ApiResponse({ status: 201, description: 'Group notification sent' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  async sendGroupNotification(
    @Request() req: ExpressRequest,
    @Body() sendGroupNotificationDto: SendGroupNotificationDto,
  ) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const notifications = await this.notificationsService.sendGroupNotification(
      sendGroupNotificationDto,
    );

    return {
      success: true,
      data: {
        count: notifications.length,
        notifications: notifications.map((n) => ({
          id: n.id,
          userId: n.userId,
          type: n.type,
          title: n.title,
        })),
      },
      message: 'Group notification sent successfully',
    };
  }

  // SECURITY (Phase 0.6): the "dev only" comment below never actually
  // checked anything — `this.scheduledNotificationsService` is always
  // injected, so the guard was always true and ANY authenticated user could
  // force-trigger the daily selection job in production. AdminGuard now
  // requires a genuine admin token (see Phase 0.2/0.3).
  @Post('trigger-daily-selection')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Manually trigger daily selection notifications (admin only)',
    description:
      'Manually trigger the daily selection notification job for testing',
  })
  @ApiResponse({
    status: 201,
    description: 'Daily selection notifications triggered',
  })
  async triggerDailySelectionNotifications(@Request() req: ExpressRequest) {
    this.logger.setContext({
      adminId: req.admin!.id,
      adminEmail: req.admin!.email,
    });

    await this.scheduledNotificationsService.triggerDailySelectionNotifications();

    return {
      success: true,
      message: 'Daily selection notifications triggered successfully',
    };
  }

  @Post('push-tokens')
  @ApiOperation({
    deprecated: true,
    summary: 'Register a push notification token',
  })
  @ApiResponse({
    status: 201,
    description: 'Push token registered successfully',
  })
  async registerPushToken(
    @Request() req: ExpressRequest,
    @Body() registerPushTokenDto: RegisterPushTokenDto,
  ) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const pushToken = await this.notificationsService.registerPushToken(
      userId,
      registerPushTokenDto.token,
      registerPushTokenDto.platform,
      registerPushTokenDto.appVersion,
      registerPushTokenDto.deviceId,
    );

    return {
      success: true,
      data: {
        id: pushToken.id,
        platform: pushToken.platform,
        isActive: pushToken.isActive,
      },
      message: 'Push token registered successfully',
    };
  }

  @Delete('push-tokens')
  @ApiOperation({
    deprecated: true,
    summary: 'Delete a push notification token',
  })
  @ApiResponse({
    status: 200,
    description: 'Push token deleted successfully',
  })
  async deletePushToken(
    @Request() req: ExpressRequest,
    @Body() deletePushTokenDto: DeletePushTokenDto,
  ) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    await this.notificationsService.deletePushToken(
      userId,
      deletePushTokenDto.token,
    );

    return {
      success: true,
      message: 'Push token deleted successfully',
    };
  }

  @Get('push-tokens')
  @ApiOperation({
    deprecated: true,
    summary: 'Get all push tokens for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Push tokens retrieved successfully',
  })
  async getPushTokens(@Request() req: ExpressRequest) {
    const userId = (req.user as User).id;

    this.logger.setContext({ userId, userEmail: (req.user as User).email });

    const pushTokens =
      await this.notificationsService.getUserPushTokens(userId);

    return {
      success: true,
      data: pushTokens.map((token) => ({
        id: token.id,
        platform: token.platform,
        appVersion: token.appVersion,
        deviceId: token.deviceId,
        isActive: token.isActive,
        lastUsedAt: token.lastUsedAt,
        createdAt: token.createdAt,
      })),
    };
  }
}
