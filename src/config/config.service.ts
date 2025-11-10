import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class ConfigService {
  get(key: string, fallback?: any) {
    return process.env[key] ?? fallback;
  }
}
