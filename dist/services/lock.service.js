"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var LockService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
let LockService = LockService_1 = class LockService {
    constructor() {
        this.logger = new common_1.Logger(LockService_1.name);
        this.redis = null;
        this.inMemoryLocks = new Map();
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            this.redis = new ioredis_1.default(redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                retryStrategy: () => null,
            });
            this.redis.connect().catch((err) => {
                this.logger.warn('Redis not available, using in-memory locks:', err.message);
                this.redis = null;
            });
        }
        catch (error) {
            this.logger.warn('Failed to initialize Redis, using in-memory locks');
            this.redis = null;
        }
    }
    async lock(key, ttl = 5000) {
        if (this.redis?.status === 'ready') {
            try {
                const result = await this.redis.set(key, '1', 'PX', ttl, 'NX');
                return result === 'OK';
            }
            catch (error) {
                this.logger.warn('Redis lock failed, falling back to in-memory');
                return this.lockInMemory(key, ttl);
            }
        }
        return this.lockInMemory(key, ttl);
    }
    async unlock(key) {
        if (this.redis?.status === 'ready') {
            try {
                await this.redis.del(key);
                return;
            }
            catch (error) {
                this.logger.warn('Redis unlock failed, using in-memory');
            }
        }
        this.unlockInMemory(key);
    }
    lockInMemory(key, ttl) {
        const now = Date.now();
        const expiry = this.inMemoryLocks.get(key);
        if (!expiry || expiry < now) {
            this.inMemoryLocks.set(key, now + ttl);
            return true;
        }
        return false;
    }
    unlockInMemory(key) {
        this.inMemoryLocks.delete(key);
    }
};
exports.LockService = LockService;
exports.LockService = LockService = LockService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LockService);
//# sourceMappingURL=lock.service.js.map