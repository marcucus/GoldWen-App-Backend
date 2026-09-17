import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminGuard } from './admin.guard';
import { Repository } from 'typeorm';
import { Admin } from '../../../database/entities/admin.entity';

/**
 * Regression tests for Phase 0.2 / 0.3 — before this guard existed, every
 * admin/* route only checked JwtAuthGuard, so ANY authenticated regular
 * user could reach them with their own (non-admin) JWT. These tests pin
 * down the three things that must independently hold before a request is
 * treated as coming from an admin: a verifiable JWT, a `type: 'admin'`
 * claim (never trusted from a plain user token), and a matching, active
 * row in the `admins` table.
 */
describe('AdminGuard', () => {
  let guard: AdminGuard;
  let mockJwtService: jest.Mocked<Pick<JwtService, 'verifyAsync'>>;
  let mockAdminRepository: jest.Mocked<Pick<Repository<Admin>, 'findOne'>>;

  const buildContext = (
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const request = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockJwtService = {
      verifyAsync: jest.fn(),
    };
    mockAdminRepository = {
      findOne: jest.fn(),
    };
    guard = new AdminGuard(
      mockJwtService as unknown as JwtService,
      mockAdminRepository as unknown as Repository<Admin>,
    );
  });

  it('should reject a request with no bearer token', async () => {
    const context = buildContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should reject an unverifiable / expired token', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    const context = buildContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject a valid, ordinary USER token (no admin claim)', async () => {
    // This is exactly the pre-fix vulnerability: a normal, currently-valid
    // user session token used to be enough to pass JwtAuthGuard alone.
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'admin', // client-asserted field — must never be trusted
      type: 'user',
    });
    const context = buildContext({ authorization: 'Bearer user-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockAdminRepository.findOne).not.toHaveBeenCalled();
  });

  it('should reject an admin-typed token whose admin row is inactive or gone', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      type: 'admin',
    });
    mockAdminRepository.findOne.mockResolvedValue(null);
    const context = buildContext({ authorization: 'Bearer admin-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockAdminRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'admin-1', isActive: true },
    });
  });

  it('should allow a genuine, active admin token and attach request.admin', async () => {
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
      type: 'admin',
    });
    const mockAdmin = { id: 'admin-1', isActive: true } as Admin;
    mockAdminRepository.findOne.mockResolvedValue(mockAdmin);

    const request: { headers: Record<string, string>; admin?: Admin } = {
      headers: { authorization: 'Bearer admin-token' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.admin).toBe(mockAdmin);
  });
});
