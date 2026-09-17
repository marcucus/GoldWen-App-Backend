import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Décision d'architecture "suppression de compte vs. rétention indépendante"
 * (voir docs/DATA_RETENTION_POLICY.md, section dédiée) : les signalements,
 * tickets support et abonnements doivent survivre à la suppression du
 * compte utilisateur le temps de leur propre durée de conservation (12
 * mois pour les signalements/tickets, jusqu'à 10 ans pour les abonnements
 * au titre de l'exception comptable), au lieu de disparaître immédiatement
 * en cascade avec la ligne User.
 *
 * On remplace donc onDelete: 'CASCADE' par onDelete: 'SET NULL' sur :
 * - reports.reporterId
 * - reports.reportedUserId
 * - support_tickets.userId
 * - subscriptions.userId
 *
 * Ce qui impose de rendre ces colonnes nullable. Les schedulers de purge
 * existants (purgeClosedReports, purgeClosedSupportTickets) continuent de
 * fonctionner à l'identique sur ces lignes une fois userId/reporterId/
 * reportedUserId passés à NULL ; un nouveau job de purge à 10 ans pour les
 * abonnements est ajouté séparément dans RetentionScheduler.
 */
export class AddSetNullRetentionForeignKeys1789654000000
  implements MigrationInterface
{
  name = 'AddSetNullRetentionForeignKeys1789654000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // reports.reporterId
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "FK_4353be8309ce86650def2f8572d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "reporterId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_4353be8309ce86650def2f8572d" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // reports.reportedUserId
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "FK_c88d2686339ad6d166620b741a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "reportedUserId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_c88d2686339ad6d166620b741a6" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // support_tickets.userId
    await queryRunner.query(
      `ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "FK_8679e2ff150ff0e253189ca0253"`,
    );
    await queryRunner.query(
      `ALTER TABLE "support_tickets" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "support_tickets" ADD CONSTRAINT "FK_8679e2ff150ff0e253189ca0253" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // subscriptions.userId
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "FK_fbdba4e2ac694cf8c9cecf4dc84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // NOTE : le down ne peut pas être appliqué s'il existe déjà des lignes
    // avec une colonne NULL (violerait NOT NULL) — à nettoyer manuellement
    // avant rollback si nécessaire, ce qui est attendu pour une migration
    // qui relâche une contrainte.
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "FK_fbdba4e2ac694cf8c9cecf4dc84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "FK_8679e2ff150ff0e253189ca0253"`,
    );
    await queryRunner.query(
      `ALTER TABLE "support_tickets" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "support_tickets" ADD CONSTRAINT "FK_8679e2ff150ff0e253189ca0253" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "FK_c88d2686339ad6d166620b741a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "reportedUserId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_c88d2686339ad6d166620b741a6" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "FK_4353be8309ce86650def2f8572d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ALTER COLUMN "reporterId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_4353be8309ce86650def2f8572d" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
