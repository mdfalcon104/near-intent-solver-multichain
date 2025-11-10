import { ConfigService } from '../config/config.service';
import { ethers } from 'ethers';
import * as nearAPI from 'near-api-js';
export interface ChainConfig {
    chainId: string;
    privateKey: string;
    rpcUrl?: string;
    networkId?: string;
}
export declare class ChainKeysService {
    private config;
    private chainConfigs;
    constructor(config: ConfigService);
    private loadChainConfigs;
    getChainConfig(chainId: string): ChainConfig | undefined;
    isChainSupported(chainId: string): boolean;
    getSupportedChains(): string[];
    getEvmSigner(chainId: string): ethers.Wallet | null;
    getNearAccount(accountId?: string): Promise<nearAPI.Account | null>;
    getAddress(chainId: string): string | null;
    signTransaction(chainId: string, transaction: any): Promise<string | null>;
}
