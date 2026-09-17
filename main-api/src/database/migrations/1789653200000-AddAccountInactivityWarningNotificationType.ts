import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountInactivityWarningNotificationType1789653200000
  implements MigrationInterface
{
  name = 'AddAccountInactivityWarningNotificationType1789653200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'account_inactivity_warning'`,
    );
  }

  async down(): Promise<void> {
    // PostgreSQL cannot remove an enum value safely without rewriting existing rows.
  }
}
