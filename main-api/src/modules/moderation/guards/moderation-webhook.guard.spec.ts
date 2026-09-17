import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationWebhookGuard } from './moderation-webhook.guard';

/**
 * Regression tests for Phase 0.5 — POST /moderation/webhook/photo used to
 * accept any photoId with no authentication at all. This guard must fail
 * closed (reject) whenever the shared secret isn't configured, and only
 * accept requests that present the exact configured secret.
 */
describe('ModerationWebhookGuard', () => {
  let guard: ModerationWebhookGuard;
  let mockConfigService: { get: jest.Mock };

  const buildContext = (
    headers: Record<string, string> = {},
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    mockConfigService = { get: jest.fn() };
    guard = new ModerationWebhookGuard(
      mockConfigService as unknown as ConfigService,
    );
  });

  it('should fail closed when no webhook secret is configured', () => {
    mockConfigService.get.mockReturnValue(undefined);
    const context = buildContext({
      'x-moderation-webhook-secret': 'anything',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject a request with no secret header', () => {
    mockConfigService.get.mockReturnValue('correct-secret');
    const context = buildContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject a request with the wrong secret', () => {
    mockConfigService.get.mockReturnValue('correct-secret');
    const context = buildContext({
      'x-moderation-webhook-secret': 'wrong-secret',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should allow a request with the exact configured secret', () => {
    mockConfigService.get.mockReturnValue('correct-secret');
    const context = buildContext({
      'x-moderation-webhook-secret': 'correct-secret',
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
