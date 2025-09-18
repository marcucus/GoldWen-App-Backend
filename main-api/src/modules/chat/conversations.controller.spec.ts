import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let chatService: ChatService;

  const mockChatService = {
    getChatByMatchId: jest.fn(),
    getChatMessages: jest.fn(),
    sendMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConversationsController>(ConversationsController);
    chatService = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createConversation', () => {
    it('should create a conversation for a mutual match', async () => {
      const mockChat = {
        id: 'chat-id',
        matchId: 'match-id',
        status: 'active',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      mockChatService.getChatByMatchId.mockResolvedValue(mockChat);

      const req = { user: { id: 'user-id' } };
      const createConversationDto = { matchId: 'match-id' };

      const result = await controller.createConversation(req, createConversationDto);

      expect(result).toHaveProperty('id', 'chat-id');
      expect(result).toHaveProperty('matchId', 'match-id');
      expect(result).toHaveProperty('timeRemaining');
      expect(mockChatService.getChatByMatchId).toHaveBeenCalledWith('match-id', 'user-id');
    });
  });

  describe('getConversationMessages', () => {
    it('should get conversation messages', async () => {
      const mockMessages = {
        messages: [{ id: 'msg-1', content: 'Hello' }],
        total: 1,
        hasMore: false,
      };

      mockChatService.getChatMessages.mockResolvedValue(mockMessages);

      const req = { user: { id: 'user-id' } };
      const query = { page: 1, limit: 50 };

      const result = await controller.getConversationMessages(req, 'chat-id', query);

      expect(result).toEqual(mockMessages);
      expect(mockChatService.getChatMessages).toHaveBeenCalledWith('chat-id', 'user-id', 1, 50);
    });
  });

  describe('sendMessage', () => {
    it('should send a message', async () => {
      const mockMessage = {
        id: 'msg-id',
        content: 'Hello!',
        type: 'text',
        createdAt: new Date(),
      };

      mockChatService.sendMessage.mockResolvedValue(mockMessage);

      const req = { user: { id: 'user-id' } };
      const sendMessageDto = { content: 'Hello!', type: 'text' as any };

      const result = await controller.sendMessage(req, 'chat-id', sendMessageDto);

      expect(result).toEqual(mockMessage);
      expect(mockChatService.sendMessage).toHaveBeenCalledWith('chat-id', 'user-id', sendMessageDto);
    });
  });
});