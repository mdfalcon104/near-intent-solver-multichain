export declare class LockService {
    private readonly logger;
    private redis;
    private inMemoryLocks;
    constructor();
    lock(key: string, ttl?: number): Promise<boolean>;
    unlock(key: string): Promise<void>;
    private lockInMemory;
    private unlockInMemory;
}
