import {
  Controller,
  Get,
  Post,
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
import { ChatService } from './chat.service';
import { SendMessageDto, GetMessagesDto } from './dto/chat.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';

@ApiTags('conversations')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a conversation from a mutual match',
    description:
      'Creates a conversation only when both users have mutually chosen each other (match mutuel)',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Match not mutual or conversation already exists',
  })
  async createConversation(
    @Request() req: any,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    // Get the chat associated with the match
    const chat = await this.chatService.getChatByMatchId(
      createConversationDto.matchId,
      req.user.id,
    );

    return {
      id: chat.id,
      matchId: chat.matchId,
      status: chat.status,
      expiresAt: chat.expiresAt,
      createdAt: chat.createdAt,
      timeRemaining: Math.max(
        0,
        Math.floor((chat.expiresAt.getTime() - Date.now()) / 1000),
      ),
    };
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: 'Get messages from a conversation',
    description: 'Retrieves messages from a conversation with pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
  })
  async getConversationMessages(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Query() query: GetMessagesDto,
  ) {
    return this.chatService.getChatMessages(
      conversationId,
      req.user.id,
      query.page,
      query.limit,
    );
  }

  @Post(':id/messages')
  @ApiOperation({
    summary: 'Send a message in a conversation',
    description:
      'Sends a text message or emoji in a conversation. Supports emojis in the content.',
  })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Conversation expired or invalid',
  })
  async sendMessage(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      conversationId,
      req.user.id,
      sendMessageDto,
    );
  }
}