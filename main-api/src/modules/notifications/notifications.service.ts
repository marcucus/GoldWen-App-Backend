import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Notification } from '../../database/entities/notification.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationType } from '../../common/enums';
import { CustomLoggerService } from '../../common/logger';

import {
  GetNotificationsDto,
  CreateNotificationDto,
  UpdateNotificationSettingsDto,
  TestNotificationDto,
} from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private logger: CustomLoggerService,
  ) {}

  async getNotifications(
    userId: string, 
    getNotificationsDto: GetNotificationsDto
  ): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
    unreadCount: number;
  }> {
    const { page = 1, limit = 20, type, read } = getNotificationsDto;
    const skip = (page - 1) * limit;

    const whereCondition: any = { userId };
    
    if (type) {
      whereCondition.type = type;
    }

    if (typeof read === 'boolean') {
      whereCondition.isRead = read;
    }

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Get unread count
    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    this.logger.logUserAction('get_notifications', userId, {
      total,
      page,
      limit,
      unreadCount,
      filters: { type, read },
    });

    return { notifications, total, page, limit, unreadCount };
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.isRead) {
      return notification; // Already read
    }

    notification.isRead = true;
    notification.readAt = new Date();

    const updatedNotification = await this.notificationRepository.save(notification);

    this.logger.logUserAction('mark_notification_read', userId, {
      notificationId,
      type: notification.type,
    });

    return updatedNotification;
  }

  async markAllAsRead(userId: string): Promise<{ affected: number }> {
    const result = await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    this.logger.logUserAction('mark_all_notifications_read', userId, {
      affected: result.affected,
    });

    return { affected: result.affected || 0 };
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepository.delete(notificationId);

    this.logger.logUserAction('delete_notification', userId, {
      notificationId,
      type: notification.type,
    });
  }

  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const { userId, type, title, body, data, scheduledFor } = createNotificationDto;

    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      body,
      data,
      scheduledFor,
      isSent: !scheduledFor, // If not scheduled, mark as sent immediately
      sentAt: scheduledFor ? undefined : new Date(),
    });

    const savedNotification = await this.notificationRepository.save(notification);

    this.logger.logBusinessEvent('notification_created', {
      notificationId: savedNotification.id,
      userId,
      type,
      scheduled: !!scheduledFor,
    });

    // TODO: Integrate with actual push notification service (FCM, etc.)
    if (!scheduledFor) {
      await this.sendPushNotification(savedNotification);
    }

    return savedNotification;
  }

  async sendTestNotification(userId: string, testNotificationDto: TestNotificationDto): Promise<Notification> {
    // Only allow in development
    if (this.configService.get('app.environment') === 'production') {
      throw new ForbiddenException('Test notifications are only available in development');
    }

    const { title, body, type } = testNotificationDto;

    const notification = await this.createNotification({
      userId,
      type: type || NotificationType.DAILY_SELECTION,
      title: title || 'Test Notification',
      body: body || 'This is a test notification from GoldWen API',
      data: { test: true, timestamp: new Date().toISOString() },
    });

    this.logger.logUserAction('send_test_notification', userId, {
      notificationId: notification.id,
      type: notification.type,
    });

    return notification;
  }

  async updateNotificationSettings(
    userId: string,
    updateSettingsDto: UpdateNotificationSettingsDto
  ): Promise<{ message: string; settings: UpdateNotificationSettingsDto }> {
    // In a real implementation, this would update user preferences in the database
    // For now, we'll just log it and return the settings
    
    this.logger.logUserAction('update_notification_settings', userId, updateSettingsDto);

    // TODO: Implement user notification preferences table and save settings
    
    return {
      message: 'Notification settings updated successfully',
      settings: updateSettingsDto,
    };
  }

  // Helper method to send actual push notifications
  private async sendPushNotification(notification: Notification): Promise<void> {
    try {
      // TODO: Implement actual push notification logic
      // This would integrate with Firebase Cloud Messaging (FCM) or similar service
      
      this.logger.info('Push notification sent', {
        notificationId: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
      });

      // Update notification as sent
      await this.notificationRepository.update(notification.id, {
        isSent: true,
        sentAt: new Date(),
      });

    } catch (error) {
      this.logger.error('Failed to send push notification', error.stack, 'NotificationsService');
      
      // TODO: Implement retry logic or move to queue
    }
  }

  // Business logic methods for creating specific types of notifications

  async sendDailySelectionNotification(userId: string): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.DAILY_SELECTION,
      title: 'Votre sélection GoldWen du jour est arrivée !',
      body: 'Découvrez vos nouvelles suggestions de profils compatibles.',
      data: { action: 'view_daily_selection' },
    });
  }

  async sendNewMatchNotification(userId: string, matchedUserName: string): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.NEW_MATCH,
      title: 'Félicitations ! Vous avez un match !',
      body: `Vous avez un match avec ${matchedUserName}. Commencez à discuter !`,
      data: { action: 'open_chat', matchedUserName },
    });
  }

  async sendNewMessageNotification(userId: string, senderName: string): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.NEW_MESSAGE,
      title: 'Nouveau message',
      body: `${senderName} vous a envoyé un message.`,
      data: { action: 'open_chat', senderName },
    });
  }

  async sendChatExpiringNotification(userId: string, partnerName: string, hoursLeft: number): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.CHAT_EXPIRING,
      title: 'Votre conversation expire bientôt !',
      body: `Il vous reste ${hoursLeft}h pour discuter avec ${partnerName}.`,
      data: { action: 'open_chat', partnerName, hoursLeft },
    });
  }

  async sendSubscriptionExpiredNotification(userId: string): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.SUBSCRIPTION_EXPIRED,
      title: 'Votre abonnement GoldWen Plus a expiré',
      body: 'Renouvelez votre abonnement pour continuer à profiter des fonctionnalités premium.',
      data: { action: 'renew_subscription' },
    });
  }
}