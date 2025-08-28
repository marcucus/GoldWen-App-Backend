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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  RevenueCatWebhookDto,
} from './dto/subscription.dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async createSubscription(
    @Request() req: any,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.createSubscription(req.user.id, createSubscriptionDto);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active subscription' })
  @ApiResponse({ status: 200, description: 'Active subscription retrieved' })
  async getActiveSubscription(@Request() req: any) {
    return this.subscriptionsService.getActiveSubscription(req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all user subscriptions' })
  @ApiResponse({ status: 200, description: 'Subscriptions retrieved successfully' })
  async getUserSubscriptions(@Request() req: any) {
    return this.subscriptionsService.getUserSubscriptions(req.user.id);
  }

  @Get('features')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription features' })
  @ApiResponse({ status: 200, description: 'Subscription features retrieved' })
  async getSubscriptionFeatures(@Request() req: any) {
    return this.subscriptionsService.getSubscriptionFeatures(req.user.id);
  }

  @Put(':subscriptionId/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription activated successfully' })
  async activateSubscription(@Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.activateSubscription(subscriptionId);
  }

  @Put(':subscriptionId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled successfully' })
  async cancelSubscription(@Request() req: any, @Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.cancelSubscription(subscriptionId, req.user.id);
  }

  @Put(':subscriptionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a subscription' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  async updateSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.updateSubscription(subscriptionId, updateSubscriptionDto);
  }

  // RevenueCat webhook endpoint
  @Post('webhook/revenuecat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle RevenueCat webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleRevenueCatWebhook(@Body() webhookData: RevenueCatWebhookDto) {
    await this.subscriptionsService.handleRevenueCatWebhook(webhookData);
    return { status: 'ok' };
  }

  // Admin endpoints
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Subscription statistics retrieved' })
  async getSubscriptionStats() {
    // TODO: Add admin role guard
    return this.subscriptionsService.getSubscriptionStats();
  }
}