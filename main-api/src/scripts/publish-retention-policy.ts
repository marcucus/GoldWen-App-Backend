import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LegalService } from '../modules/legal/legal.service';

async function publish() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await app.get(LegalService).publishRetentionPolicy();
  } finally {
    await app.close();
  }
}
void publish().catch(() => {
  process.exitCode = 1;
});
