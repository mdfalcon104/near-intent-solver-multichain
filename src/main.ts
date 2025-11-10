import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as bodyParser from 'body-parser';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(bodyParser.json({ limit: '2mb' }));
  await app.listen(process.env.PORT || 8080);
  console.log(`🚀 Solver running on port ${process.env.PORT || 8080}`);
}
bootstrap();
