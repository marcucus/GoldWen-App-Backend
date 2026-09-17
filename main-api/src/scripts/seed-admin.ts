/**
 * Bootstraps the very first admin account (Phase 0.3).
 *
 * There is intentionally no HTTP endpoint to create an admin — the only way
 * in is this one-off script, run manually against the target environment:
 *
 *   ADMIN_SEED_EMAIL=you@goldwen.com \
 *   ADMIN_SEED_PASSWORD='a strong, unique password' \
 *   ADMIN_SEED_FIRST_NAME=Jane \
 *   ADMIN_SEED_LAST_NAME=Doe \
 *   npm run seed:admin
 *
 * It is idempotent: re-running it with the same email is a no-op if that
 * admin already exists (see AdminService.createInitialAdminIfMissing).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AdminService } from '../modules/admin/admin.service';
import { AdminRole } from '../common/enums';

async function seedAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const firstName = process.env.ADMIN_SEED_FIRST_NAME || 'Admin';
  const lastName = process.env.ADMIN_SEED_LAST_NAME || 'GoldWen';

  if (!email || !password) {
    console.error(
      'ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD environment variables are required.',
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('ADMIN_SEED_PASSWORD must be at least 12 characters long.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const adminService = app.get(AdminService);

  try {
    const admin = await adminService.createInitialAdminIfMissing({
      email,
      password,
      firstName,
      lastName,
      role: AdminRole.SUPER_ADMIN,
    });

    console.log(`✅ Admin ready: ${admin.email} (role: ${admin.role})`);
    console.log(
      'If this admin already existed, its password was NOT changed.',
    );
  } finally {
    await app.close();
  }
}

seedAdmin().catch((error) => {
  console.error('❌ Failed to seed admin:', error);
  process.exit(1);
});
