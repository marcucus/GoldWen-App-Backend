import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddCancelledDeletionStatus1789650000000 implements MigrationInterface {
  name = 'AddCancelledDeletionStatus1789650000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "account_deletions_status_enum" ADD VALUE IF NOT EXISTS 'cancelled'`);
  }
  async down(): Promise<void> {
    // PostgreSQL cannot remove an enum value safely without rewriting existing rows.
  }
}
