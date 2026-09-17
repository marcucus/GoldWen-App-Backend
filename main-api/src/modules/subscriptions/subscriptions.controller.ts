import type { Request as ExpressRequest } from 'express';
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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SubscriptionsService } from './subscriptions.service';
import { User } from '../../database/entities/user.entity';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subscription' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
  })
  async createSubscription(
    @Request() req: ExpressRequest,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.createSubscription(
      (req.user as User).id,
      createSubscriptionDto,
    );
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active subscription' })
  @ApiResponse({ status: 200, description: 'Active subscription retrieved' })
  async getActiveSubscription(@Request() req: ExpressRequest) {
    return this.subscriptionsService.getActiveSubscription(
      (req.user as User).id,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all user subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions retrieved successfully',
  })
  async getUserSubscriptions(@Request() req: ExpressRequest) {
    return this.subscriptionsService.getUserSubscriptions(
      (req.user as User).id,
    );
  }

  @Get('features')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription features' })
  @ApiResponse({ status: 200, description: 'Subscription features retrieved' })
  async getSubscriptionFeatures(@Request() req: ExpressRequest) {
    return this.subscriptionsService.getSubscriptionFeatures(
      (req.user as User).id,
    );
  }

  @Put(':subscriptionId/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate a subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription activated successfully',
  })
  async activateSubscription(@Param('subscriptionId') subscriptionId: string) {
    return this.subscriptionsService.activateSubscription(subscriptionId);
  }

  @Put(':subscriptionId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
  })
  async cancelSubscription(
    @Request() req: ExpressRequest,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.subscriptionsService.cancelSubscription(
      subscriptionId,
      (req.user as User).id,
    );
  }

  @Put(':subscriptionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
  })
  async updateSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.updateSubscription(
      subscriptionId,
      updateSubscriptionDto,
    );
  }

  // SECURITY (Phase 0.4): this duplicate webhook endpoint took RevenueCat
  // payloads with NO authentication and NO signature check whatsoever —
  // anyone could POST a fake INITIAL_PURCHASE event here and grant
  // themselves GoldWen Plus for free. RevenueCatController's
  // POST /webhooks/revenuecat (mandatory HMAC signature, verified against
  // the raw request body) is now the single entry point for RevenueCat
  // events; this route has been removed.

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({
    status: 200,
    description: 'Current subscription retrieved successfully',
  })
  async getCurrentSubscription(@Request() req: ExpressRequest) {
    return this.subscriptionsService.getActiveSubscription(
      (req.user as User).id,
    );
  }

  @Put('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel user subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
  })
  async cancelUserSubscription(
    @Request() req: ExpressRequest,
    @Body() cancelDto?: { reason?: string },
  ) {
    return this.subscriptionsService.cancelUserSubscription(
      (req.user as User).id,
      cancelDto?.reason,
    );
  }

  @Post('restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore subscriptions' })
  @ApiResponse({
    status: 200,
    description: 'Subscriptions restored successfully',
  })
  async restoreSubscriptions(@Request() req: ExpressRequest) {
    return this.subscriptionsService.restoreSubscriptions(
      (req.user as User).id,
    );
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription usage' })
  @ApiResponse({
    status: 200,
    description: 'Usage statistics retrieved successfully',
  })
  async getUsage(@Request() req: ExpressRequest) {
    return this.subscriptionsService.getUsage((req.user as User).id);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  @ApiResponse({
    status: 200,
    description: 'Plans retrieved successfully',
  })
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('tier')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user subscription tier and features' })
  @ApiResponse({
    status: 200,
    description: 'User subscription tier retrieved successfully',
  })
  async getUserTier(@Request() req: ExpressRequest) {
    return this.subscriptionsService.getUserSubscriptionTier(
      (req.user as User).id,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete/Cancel a subscription by ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
  })
  async deleteSubscription(
    @Request() req: ExpressRequest,
    @Param('id') subscriptionId: string,
  ) {
    return this.subscriptionsService.cancelSubscription(
      subscriptionId,
      (req.user as User).id,
    );
  }

  // Admin endpoints
  @Get('admin/stats')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Subscription statistics retrieved',
  })
  async getSubscriptionStats() {
    return this.subscriptionsService.getSubscriptionStats();
  }
}
