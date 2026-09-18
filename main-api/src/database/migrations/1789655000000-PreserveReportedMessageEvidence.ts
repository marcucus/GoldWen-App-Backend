import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreserveReportedMessageEvidence1789655000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE reports ADD COLUMN "retainedEvidence" jsonb, ADD COLUMN "retentionHoldUntil" timestamp',
    );
    await queryRunner.query(
      'ALTER TABLE reports DROP CONSTRAINT "FK_7867c6f5d2606991b3580e3e0dd", DROP CONSTRAINT "FK_e1902ef5218fb91f940ed309ba8"',
    );
    await queryRunner.query(
      'ALTER TABLE reports ADD CONSTRAINT "FK_7867c6f5d2606991b3580e3e0dd" FOREIGN KEY ("messageId") REFERENCES messages(id) ON DELETE SET NULL, ADD CONSTRAINT "FK_e1902ef5218fb91f940ed309ba8" FOREIGN KEY ("chatId") REFERENCES chats(id) ON DELETE SET NULL',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE reports DROP CONSTRAINT "FK_7867c6f5d2606991b3580e3e0dd", DROP CONSTRAINT "FK_e1902ef5218fb91f940ed309ba8"',
    );
    await queryRunner.query(
      'ALTER TABLE reports ADD CONSTRAINT "FK_7867c6f5d2606991b3580e3e0dd" FOREIGN KEY ("messageId") REFERENCES messages(id) ON DELETE NO ACTION, ADD CONSTRAINT "FK_e1902ef5218fb91f940ed309ba8" FOREIGN KEY ("chatId") REFERENCES chats(id) ON DELETE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE reports DROP COLUMN "retainedEvidence", DROP COLUMN "retentionHoldUntil"',
    );
  }
}
