import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Support de la nouvelle politique de rétention pour les comptes inactifs :
 * suppression après 12 mois d'inactivité, avec avertissement 30 jours
 * avant (voir docs/DATA_RETENTION_POLICY.md et RetentionScheduler).
 */
export class AddInactivityWarningSentAtToUsers1789653100000
  implements MigrationInterface
{
  name = 'AddInactivityWarningSentAtToUsers1789653100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inactivityWarningSentAt" TIMESTAMP`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "inactivityWarningSentAt"`,
    );
  }
}
