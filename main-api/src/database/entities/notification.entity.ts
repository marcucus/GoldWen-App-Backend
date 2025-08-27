import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { NotificationType } from '../../common/enums';
import { User } from './user.entity';

@Entity('notifications')
@Index(['userId'])
@Index(['type'])
@Index(['isRead'])
@Index(['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column()
  title: string;

  @Column()
  body: string;

  @Column({ type: 'json', nullable: true })
  data: any;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  readAt: Date;

  @Column({ default: false })
  isSent: boolean;

  @Column({ nullable: true })
  sentAt: Date;

  @Column({ nullable: true })
  scheduledFor: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;
}