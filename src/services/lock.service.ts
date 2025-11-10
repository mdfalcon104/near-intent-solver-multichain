import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);
  private redis: Redis | null = null;
  private inMemoryLocks: Map<string, number> = new Map();

  constructor() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't retry
      });

      // Test connection
      this.redis.connect().catch((err) => {
        this.logger.warn('Redis not available, using in-memory locks:', err.message);
        this.redis = null;
      });
    } catch (error) {
      this.logger.warn('Failed to initialize Redis, using in-memory locks');
      this.redis = null;
    }
  }

  async lock(key: string, ttl = 5000): Promise<boolean> {
    if (this.redis?.status === 'ready') {
      try {
        const result = await this.redis.set(key, '1', 'PX', ttl, 'NX');
        return result === 'OK';
      } catch (error) {
        this.logger.warn('Redis lock failed, falling back to in-memory');
        return this.lockInMemory(key, ttl);
      }
    }
    return this.lockInMemory(key, ttl);
  }

  async unlock(key: string) {
    if (this.redis?.status === 'ready') {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        this.logger.warn('Redis unlock failed, using in-memory');
      }
    }
    this.unlockInMemory(key);
  }

  private lockInMemory(key: string, ttl: number): boolean {
    const now = Date.now();
    const expiry = this.inMemoryLocks.get(key);

    // Lock expired or doesn't exist
    if (!expiry || expiry < now) {
      this.inMemoryLocks.set(key, now + ttl);
      return true;
    }

    return false;
  }

  private unlockInMemory(key: string) {
    this.inMemoryLocks.delete(key);
  }
}
