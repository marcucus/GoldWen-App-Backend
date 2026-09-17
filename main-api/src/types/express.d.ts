// Phase 0.4 / 4.1: NestFactory.create(AppModule, { rawBody: true }) (see main.ts)
// makes Express attach the exact raw request bytes to req.rawBody so webhook
// signature checks (RevenueCat) verify what was actually signed. The default
// Express types don't know about this option, so we extend them here.
//
// Phase 4.1 (lint cleanup): AdminGuard attaches the full Admin row to
// req.admin on success (see admin.guard.ts) — a field the stock Express
// types have never heard of, which is why admin routes had to type the
// request param as `any`. `req.user` is deliberately NOT typed here: it
// holds two different shapes depending on which guard ran (the full User
// row from JwtStrategy, or a lightweight social profile from
// GoogleStrategy/AppleStrategy's OAuth callback — see auth.controller.ts
// and src/modules/auth/strategies/*.ts), so each call site casts to the
// concrete type its own guard guarantees instead of one global fiction.
import 'express';
import type { Admin as AppAdmin } from '../database/entities/admin.entity';

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
    quotaInfo?: {
      choicesUsed: number;
      maxChoices: number;
      choicesRemaining: number;
    };
    rateLimit?: { limit: number; remaining: number; reset: number };
    // Set by AdminGuard#canActivate on success. Deliberately separate from
    // `user` — an admin session is never a User row.
    admin?: AppAdmin;
  }
}
