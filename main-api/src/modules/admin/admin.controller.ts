import type { Request as ExpressRequest } from 'express';
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminService } from './admin.service';
import {
  AdminLoginDto,
  UpdateUserStatusDto,
  HandleReportDto,
  BroadcastNotificationDto,
  GetUsersDto,
  GetReportsDto,
  SupportReplyDto,
} from './dto/admin.dto';
import { CreatePromptDto, UpdatePromptDto } from './dto/prompt.dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Admin authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() adminLoginDto: AdminLoginDto) {
    // SECURITY (Phase 0.3): real bcrypt check against admins.passwordHash,
    // and a JWT (claim type: 'admin') is now actually issued — AdminGuard
    // (Phase 0.2) requires this token on every other route below.
    const { admin, accessToken } = await this.adminService.login(adminLoginDto);

    return {
      success: true,
      message: 'Login successful',
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
      accessToken,
    };
  }

  @Get('dashboard')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved' })
  async getDashboard() {
    const stats = await this.adminService.getDashboardStats();
    const recentActivity = await this.adminService.getRecentActivity();

    return {
      stats,
      recentActivity,
    };
  }

  @Get('users')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get users list' })
  @ApiResponse({ status: 200, description: 'Users list retrieved' })
  async getUsers(@Query() getUsersDto: GetUsersDto) {
    return this.adminService.getUsers(getUsersDto);
  }

  @Get('users/:userId')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user details' })
  @ApiResponse({ status: 200, description: 'User details retrieved' })
  async getUserDetails(@Param('userId') userId: string) {
    return this.adminService.getUserDetails(userId);
  }

  @Put('users/:userId/status')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user status' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  async updateUserStatus(
    @Param('userId') userId: string,
    @Body() updateStatusDto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(userId, updateStatusDto);
  }

  @Patch('users/:id/suspend')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suspend user' })
  @ApiResponse({ status: 200, description: 'User suspended successfully' })
  async suspendUser(@Param('id') userId: string) {
    return this.adminService.suspendUser(userId);
  }

  @Delete('users/:userId')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async deleteUser(@Param('userId') userId: string) {
    await this.adminService.deleteUser(userId);
    return { message: 'User deleted successfully' };
  }

  @Get('reports')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reports list' })
  @ApiResponse({ status: 200, description: 'Reports list retrieved' })
  async getReports(@Query() getReportsDto: GetReportsDto) {
    return this.adminService.getReports(getReportsDto);
  }

  @Delete('reports/:reportId')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete report' })
  @ApiResponse({ status: 200, description: 'Report deleted successfully' })
  async deleteReport(@Param('reportId') reportId: string) {
    await this.adminService.deleteReport(reportId);
    return { message: 'Report deleted successfully' };
  }

  @Put('reports/:reportId')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Handle a report' })
  @ApiResponse({ status: 200, description: 'Report handled successfully' })
  async handleReport(
    @Param('reportId') reportId: string,
    @Body() handleReportDto: HandleReportDto,
  ) {
    return this.adminService.handleReport(reportId, handleReportDto);
  }

  @Get('analytics')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform analytics' })
  @ApiResponse({ status: 200, description: 'Analytics data retrieved' })
  async getAnalytics() {
    return this.adminService.getUserAnalytics();
  }

  @Post('notifications/broadcast')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Broadcast notification to all users' })
  @ApiResponse({
    status: 200,
    description: 'Notification broadcasted successfully',
  })
  async broadcastNotification(@Body() broadcastDto: BroadcastNotificationDto) {
    await this.adminService.broadcastNotification(broadcastDto);
    return { message: 'Notification broadcasted successfully' };
  }

  @Post('support/reply')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reply to support ticket' })
  @ApiResponse({
    status: 200,
    description: 'Support reply sent successfully',
  })
  async replySupportTicket(
    @Req() req: ExpressRequest,
    @Body() supportReplyDto: SupportReplyDto,
  ) {
    const adminEmail = req.admin!.email;
    const ticket = await this.adminService.replySupportTicket(
      supportReplyDto,
      adminEmail,
    );
    return {
      message: 'Support reply sent successfully',
      ticket,
    };
  }

  // Prompt Management Routes
  @Get('prompts')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all prompts for admin management' })
  @ApiResponse({ status: 200, description: 'Prompts retrieved successfully' })
  async getPromptsAdmin() {
    return this.adminService.getPrompts();
  }

  @Post('prompts')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new prompt' })
  @ApiResponse({ status: 201, description: 'Prompt created successfully' })
  async createPrompt(@Body() createPromptDto: CreatePromptDto) {
    return this.adminService.createPrompt(createPromptDto);
  }

  @Put('prompts/:promptId')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing prompt' })
  @ApiResponse({ status: 200, description: 'Prompt updated successfully' })
  async updatePrompt(
    @Param('promptId') promptId: string,
    @Body() updatePromptDto: UpdatePromptDto,
  ) {
    return this.adminService.updatePrompt(promptId, updatePromptDto);
  }

  @Delete('prompts/:promptId')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a prompt' })
  @ApiResponse({ status: 200, description: 'Prompt deleted successfully' })
  async deletePrompt(@Param('promptId') promptId: string) {
    await this.adminService.deletePrompt(promptId);
    return { message: 'Prompt deleted successfully' };
  }
}
