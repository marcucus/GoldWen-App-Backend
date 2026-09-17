import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') userId: string;
  @Column() type: string;
  @Column({ length: 100 }) subject: string;
  @Column('text') message: string;
  @Column('int', { nullable: true }) rating?: number;
  @Column('jsonb', { nullable: true }) metadata?: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
}
