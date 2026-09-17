import type { Request as ExpressRequest } from 'express';
import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Param,
  Body,
  Query,
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
import { ProfileCompletionGuard } from '../auth/guards/profile-completion.guard';
import { ChatService } from './chat.service';
import { User } from '../../database/entities/user.entity';
import {
  SendMessageDto,
  GetMessagesDto,
  ExtendChatDto,
  AcceptChatDto,
} from './dto/chat.dto';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard, ProfileCompletionGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Get all user chats' })
  @ApiResponse({ status: 200, description: 'Chats retrieved successfully' })
  async getUserChats(@Request() req: ExpressRequest) {
    return this.chatService.getUserChats((req.user as User).id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get chat statistics' })
  @ApiResponse({
    status: 200,
    description: 'Chat statistics retrieved successfully',
  })
  async getChatStats(@Request() req: ExpressRequest) {
    return this.chatService.getChatStats((req.user as User).id);
  }

  @Get('match/:matchId')
  @ApiOperation({ summary: 'Get chat by match ID' })
  @ApiResponse({ status: 200, description: 'Chat retrieved successfully' })
  async getChatByMatchId(
    @Request() req: ExpressRequest,
    @Param('matchId') matchId: string,
  ) {
    return this.chatService.getChatByMatchId(matchId, (req.user as User).id);
  }

  @Get(':chatId')
  @ApiOperation({
    summary: 'Get an active conversation owned by the current user',
  })
  async getChat(
    @Request() req: ExpressRequest,
    @Param('chatId') chatId: string,
  ) {
    return this.chatService.getChatById(chatId, (req.user as User).id);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Get chat messages' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  async getChatMessages(
    @Request() req: ExpressRequest,
    @Param('chatId') chatId: string,
    @Query() query: GetMessagesDto,
  ) {
    return this.chatService.getChatMessages(
      chatId,
      (req.user as User).id,
      query.page,
      query.limit,
    );
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(
    @Request() req: ExpressRequest,
    @Param('chatId') chatId: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      chatId,
      (req.user as User).id,
      sendMessageDto,
    );
  }

  @Put(':chatId/messages/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markMessagesAsRead(
    @Request() req: ExpressRequest,
    @Param('chatId') chatId: string,
  ) {
    await this.chatService.markMessagesAsRead(chatId, (req.user as User).id);
    return { message: 'Messages marked as read' };
  }

  @Delete('messages/:messageId')
  @ApiOperation({ summary: 'Delete a message' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  async deleteMessage(
    @Request() req: ExpressRequest,
    @Param('messageId') messageId: string,
  ) {
    await this.chatService.deleteMessage(messageId, (req.user as User).id);
    return { message: 'Message deleted successfully' };
  }

  @Put(':chatId/extend')
  @ApiOperation({ summary: 'Extend chat expiry time (premium feature)' })
  @ApiResponse({ status: 200, description: 'Chat time extended successfully' })
  async extendChatTime(
    @Request() req: ExpressRequest,
    @Param('chatId') chatId: string,
    @Body() extendChatDto: ExtendChatDto,
  ) {
    return this.chatService.extendChatTime(
      chatId,
      (req.user as User).id,
      extendChatDto.hours,
    );
  }

  @Post('accept/:matchId')
  @ApiOperation({ summary: 'Accept or decline a chat request from a match' })
  @ApiResponse({
    status: 200,
    description: 'Chat request processed successfully',
  })
  async acceptChatRequest(
    @Request() req: ExpressRequest,
    @Param('matchId') matchId: string,
    @Body() acceptChatDto: AcceptChatDto,
  ) {
    return this.chatService.acceptChatRequest(
      matchId,
      (req.user as User).id,
      acceptChatDto.accept,
    );
  }
}
