import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalController } from './legal.controller';
import { LegalService } from './legal.service';
import { TermsOfService } from '../../database/entities/terms-of-service.entity';
import { PrivacyPolicy } from '../../database/entities/privacy-policy.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PrivacyPolicy, TermsOfService])],
  controllers: [LegalController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
