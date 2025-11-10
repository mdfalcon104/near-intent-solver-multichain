import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ethers } from 'ethers';
import * as nearAPI from 'near-api-js';

export interface ChainConfig {
  chainId: string;
  privateKey: string;
  rpcUrl?: string;
  networkId?: string;
}

@Injectable()
export class ChainKeysService {
  private chainConfigs: Map<string, ChainConfig> = new Map();

  constructor(private config: ConfigService) {
    this.loadChainConfigs();
  }

  /**
   * Load chain configurations from environment variables
   * Expected format:
   * CHAIN_<CHAIN_NAME>_PRIVATE_KEY=...
   * CHAIN_<CHAIN_NAME>_RPC_URL=...
   * 
   * Example:
   * CHAIN_NEAR_PRIVATE_KEY=ed25519:...
   * CHAIN_NEAR_NETWORK_ID=testnet
   * CHAIN_ETHEREUM_PRIVATE_KEY=0x...
   * CHAIN_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/...
   * CHAIN_ARBITRUM_PRIVATE_KEY=0x...
   * CHAIN_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
   * CHAIN_SOLANA_PRIVATE_KEY=base58...
   * CHAIN_BITCOIN_PRIVATE_KEY=...
   */
  private loadChainConfigs() {
    const chains = [
      'NEAR',
      'ETHEREUM', 
      'ARBITRUM',
      'POLYGON',
      'AVALANCHE',
      'BSC',
      'OPTIMISM',
      'BASE',
      'SOLANA',
      'BITCOIN',
      'AURORA'
    ];

    for (const chain of chains) {
      const privateKey = this.config.get(`CHAIN_${chain}_PRIVATE_KEY`);
      if (privateKey) {
        const chainConfig: ChainConfig = {
          chainId: chain.toLowerCase(),
          privateKey,
          rpcUrl: this.config.get(`CHAIN_${chain}_RPC_URL`),
          networkId: this.config.get(`CHAIN_${chain}_NETWORK_ID`),
        };
        this.chainConfigs.set(chain.toLowerCase(), chainConfig);
      }
    }
  }

  /**
   * Get chain configuration by chain ID
   */
  getChainConfig(chainId: string): ChainConfig | undefined {
    return this.chainConfigs.get(chainId.toLowerCase());
  }

  /**
   * Check if chain is supported (has private key configured)
   */
  isChainSupported(chainId: string): boolean {
    return this.chainConfigs.has(chainId.toLowerCase());
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): string[] {
    return Array.from(this.chainConfigs.keys());
  }

  /**
   * Get EVM signer for a specific chain
   */
  getEvmSigner(chainId: string): ethers.Wallet | null {
    const config = this.getChainConfig(chainId);
    if (!config || !config.privateKey) {
      return null;
    }

    try {
      const wallet = new ethers.Wallet(config.privateKey);
      if (config.rpcUrl) {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        return wallet.connect(provider);
      }
      return wallet;
    } catch (error) {
      console.error(`Failed to create EVM signer for ${chainId}:`, error);
      return null;
    }
  }

  /**
   * Get NEAR account/keypair for signing
   */
  async getNearAccount(accountId?: string): Promise<nearAPI.Account | null> {
    const config = this.getChainConfig('near');
    if (!config || !config.privateKey) {
      return null;
    }

    try {
      const networkId = config.networkId || 'testnet';
      const keyPair = nearAPI.utils.KeyPair.fromString(config.privateKey);
      
      const connectionConfig: nearAPI.ConnectConfig = {
        networkId,
        keyStore: new nearAPI.keyStores.InMemoryKeyStore(),
        nodeUrl: config.rpcUrl || `https://rpc.${networkId}.near.org`,
        walletUrl: `https://wallet.${networkId}.near.org`,
        helperUrl: `https://helper.${networkId}.near.org`,
      };

      const near = await nearAPI.connect(connectionConfig);
      
      // Derive account ID from public key if not provided
      const actualAccountId = accountId || config.networkId || 'solver.testnet';
      
      // Add key to keystore
      await connectionConfig.keyStore.setKey(networkId, actualAccountId, keyPair);
      
      return await near.account(actualAccountId);
    } catch (error) {
      console.error('Failed to create NEAR account:', error);
      return null;
    }
  }

  /**
   * Get address for a specific chain from private key
   */
  getAddress(chainId: string): string | null {
    const config = this.getChainConfig(chainId);
    if (!config || !config.privateKey) {
      return null;
    }

    const lowerChainId = chainId.toLowerCase();
    
    // For EVM chains
    if (['ethereum', 'arbitrum', 'polygon', 'avalanche', 'bsc', 'optimism', 'base', 'aurora'].includes(lowerChainId)) {
      try {
        const wallet = new ethers.Wallet(config.privateKey);
        return wallet.address;
      } catch (error) {
        console.error(`Failed to derive EVM address for ${chainId}:`, error);
        return null;
      }
    }

    // For NEAR
    if (lowerChainId === 'near') {
      try {
        const keyPair = nearAPI.utils.KeyPair.fromString(config.privateKey);
        return keyPair.getPublicKey().toString();
      } catch (error) {
        console.error('Failed to derive NEAR public key:', error);
        return null;
      }
    }

    // For Solana, Bitcoin, etc. - implement as needed
    return null;
  }

  /**
   * Sign a transaction for a specific chain
   */
  async signTransaction(chainId: string, transaction: any): Promise<string | null> {
    const signer = this.getEvmSigner(chainId);
    if (!signer) {
      return null;
    }

    try {
      const signedTx = await signer.signTransaction(transaction);
      return signedTx;
    } catch (error) {
      console.error(`Failed to sign transaction for ${chainId}:`, error);
      return null;
    }
  }
}
