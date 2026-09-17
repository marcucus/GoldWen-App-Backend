import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt } from 'passport-jwt';
import { Admin } from '../../../database/entities/admin.entity';

interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  type: string;
}

/**
 * AdminGuard — Phase 0.2 / 0.3
 *
 * Before this fix, every route in AdminController, MonitoringController and
 * the admin/* routes of ModerationController only used JwtAuthGuard, which
 * accepts ANY valid, active regular-user session token. Any authenticated
 * user could list/suspend/delete accounts, broadcast notifications and
 * resolve reports.
 *
 * This guard independently verifies the bearer token as an admin token: it
 * must be signed with our JWT secret, carry `type: 'admin'` (a claim only
 * AdminService.login() ever mints — a normal user JWT never has it, so the
 * two token types are not interchangeable), and resolve to an active row in
 * the `admins` table. On success it attaches the Admin entity to
 * `request.admin` (deliberately not `request.user`, which is reserved for
 * the regular User entity elsewhere in the app).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

    if (!token) {
      throw new UnauthorizedException('Admin authentication required');
    }

    let payload: AdminJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<AdminJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    if (payload.type !== 'admin') {
      // A perfectly valid user session token, just not one that proves
      // admin identity — reject it rather than trusting client-asserted
      // fields like `role` or `isAdmin`.
      throw new ForbiddenException('Admin access required');
    }

    const admin = await this.adminRepository.findOne({
      where: { id: payload.sub, isActive: true },
    });

    if (!admin) {
      throw new ForbiddenException('Admin access required');
    }

    request.admin = admin;
    return true;
  }
}
