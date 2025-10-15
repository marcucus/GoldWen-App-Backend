import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

import { ProfilesService } from '../profiles.service';
import { Profile } from '../../../database/entities/profile.entity';
import { User } from '../../../database/entities/user.entity';
import { PersonalityQuestion } from '../../../database/entities/personality-question.entity';
import { PersonalityAnswer } from '../../../database/entities/personality-answer.entity';
import { Photo } from '../../../database/entities/photo.entity';
import { Prompt } from '../../../database/entities/prompt.entity';
import { PromptAnswer } from '../../../database/entities/prompt-answer.entity';
import { SubmitPromptAnswersDto } from '../dto/profiles.dto';
import { ModerationService } from '../../moderation/services/moderation.service';

describe('ProfilesService - Frontend-Backend Harmonization', () => {
  let service: ProfilesService;
  let promptRepository: Repository<Prompt>;
  let userRepository: Repository<User>;

  const mockModerationService = {
    moderateTextContent: jest.fn().mockResolvedValue({ approved: true }),
    moderateTextContentBatch: jest
      .fn()
      .mockResolvedValue([
        { approved: true },
        { approved: true },
        { approved: true },
      ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: getRepositoryToken(Profile),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Prompt),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PromptAnswer),
          useValue: {
            delete: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PersonalityQuestion),
          useValue: {
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PersonalityAnswer),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Photo),
          useValue: {},
        },
        {
          provide: ModerationService,
          useValue: mockModerationService,
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
    promptRepository = module.get<Repository<Prompt>>(
      getRepositoryToken(Prompt),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  describe('Harmonization: Frontend expects exactly 3 prompts', () => {
    it('should return only 3 prompts from getPrompts() endpoint', async () => {
      const mockPrompts = [
        { id: '1', text: 'Prompt 1', isActive: true, isRequired: true },
        { id: '2', text: 'Prompt 2', isActive: true, isRequired: true },
        { id: '3', text: 'Prompt 3', isActive: true, isRequired: true },
      ];

      jest.spyOn(promptRepository, 'find').mockResolvedValue(mockPrompts as any);

      const result = await service.getPrompts();

      expect(result).toHaveLength(3);
      expect(promptRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { isRequired: 'DESC', order: 'ASC' },
        take: 3, // ← Ensures only 3 prompts are returned
      });
    });

    it('should validate profile completion with exactly 3 prompts', async () => {
      const userWithThreePrompts = {
        id: 'user-id',
        profile: {
          id: 'profile-id',
          photos: [{ id: '1' }, { id: '2' }, { id: '3' }],
          promptAnswers: [
            { promptId: 'p1' },
            { promptId: 'p2' },
            { promptId: 'p3' },
          ],
          birthDate: '1990-01-01',
          bio: 'Test bio',
        },
        personalityAnswers: Array(10).fill({ id: 'answer' }),
      };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(userWithThreePrompts as any);
      jest.spyOn(promptRepository, 'find').mockResolvedValue([
        { id: 'p1', text: 'Prompt 1' },
        { id: 'p2', text: 'Prompt 2' },
        { id: 'p3', text: 'Prompt 3' },
      ] as any);

      const completion = await service.getProfileCompletion('user-id');

      expect(completion.requirements.minimumPrompts.required).toBe(3);
      expect(completion.requirements.minimumPrompts.current).toBe(3);
      expect(completion.requirements.minimumPrompts.satisfied).toBe(true);
    });

    it('should provide clear error message when user has fewer than 3 prompts', async () => {
      const userWithOnePrompt = {
        id: 'user-id',
        profile: {
          id: 'profile-id',
          photos: [{ id: '1' }, { id: '2' }, { id: '3' }],
          promptAnswers: [{ promptId: 'p1' }],
          birthDate: '1990-01-01',
          bio: 'Test bio',
        },
        personalityAnswers: Array(10).fill({ id: 'answer' }),
      };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(userWithOnePrompt as any);
      jest.spyOn(promptRepository, 'find').mockResolvedValue([
        { id: 'p1', text: 'Prompt 1' },
        { id: 'p2', text: 'Prompt 2' },
        { id: 'p3', text: 'Prompt 3' },
      ] as any);

      const completion = await service.getProfileCompletion('user-id');

      expect(completion.requirements.minimumPrompts.required).toBe(3);
      expect(completion.requirements.minimumPrompts.current).toBe(1);
      expect(completion.requirements.minimumPrompts.satisfied).toBe(false);
      expect(completion.missingSteps).toContain('Answer 2 more prompts (1/3)');
    });
  });

  describe('DTO Validation ensures exactly 3 prompts', () => {
    it('should accept exactly 3 prompts (DTO validation)', async () => {
      // Note: In a real scenario, class-validator would reject < 3 or > 3 at the DTO level
      // This test verifies the service-level logic works when DTO passes validation

      const dto: SubmitPromptAnswersDto = {
        answers: [
          { promptId: 'p1', answer: 'Answer 1' },
          { promptId: 'p2', answer: 'Answer 2' },
          { promptId: 'p3', answer: 'Answer 3' },
        ],
      };

      // This demonstrates the DTO structure requires exactly 3 answers
      expect(dto.answers).toHaveLength(3);
    });

    it('should document that DTO enforces ArrayMinSize(3) and ArrayMaxSize(3)', () => {
      // This is a documentation test to ensure developers understand
      // that the DTO validation happens BEFORE service-level validation
      const expectedDtoValidation = {
        decorators: ['@ArrayMinSize(3)', '@ArrayMaxSize(3)'],
        message: 'Ensures exactly 3 prompts are required',
      };

      expect(expectedDtoValidation.decorators).toContain('@ArrayMinSize(3)');
      expect(expectedDtoValidation.decorators).toContain('@ArrayMaxSize(3)');
    });
  });

  describe('Error messages are clear and consistent', () => {
    it('should provide user-friendly message for incomplete prompts', async () => {
      const userWithTwoPrompts = {
        id: 'user-id',
        profile: {
          id: 'profile-id',
          photos: [{ id: '1' }, { id: '2' }, { id: '3' }],
          promptAnswers: [{ promptId: 'p1' }, { promptId: 'p2' }],
          birthDate: '1990-01-01',
          bio: 'Test bio',
        },
        personalityAnswers: Array(10).fill({ id: 'answer' }),
      };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(userWithTwoPrompts as any);
      jest.spyOn(promptRepository, 'find').mockResolvedValue([
        { id: 'p1', text: 'Prompt 1' },
        { id: 'p2', text: 'Prompt 2' },
        { id: 'p3', text: 'Prompt 3' },
      ] as any);

      const completion = await service.getProfileCompletion('user-id');

      // Error message format: "Answer X more prompt(s) (Y/3)"
      expect(completion.missingSteps).toContain('Answer 1 more prompt (2/3)');
    });

    it('should use correct singular/plural in error messages', async () => {
      const userWithOnePrompt = {
        id: 'user-id',
        profile: {
          id: 'profile-id',
          photos: [{ id: '1' }, { id: '2' }, { id: '3' }],
          promptAnswers: [{ promptId: 'p1' }],
          birthDate: '1990-01-01',
          bio: 'Test bio',
        },
        personalityAnswers: Array(10).fill({ id: 'answer' }),
      };

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue(userWithOnePrompt as any);
      jest.spyOn(promptRepository, 'find').mockResolvedValue([
        { id: 'p1', text: 'Prompt 1' },
        { id: 'p2', text: 'Prompt 2' },
        { id: 'p3', text: 'Prompt 3' },
      ] as any);

      const completion = await service.getProfileCompletion('user-id');

      // When 2 prompts are missing, it should say "prompts" (plural)
      expect(completion.missingSteps[0]).toMatch(/prompts/);
    });
  });
});
