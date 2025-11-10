import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class EvmService {
  private providers: Record<string, ethers.JsonRpcProvider> = {};

  getProvider(chain: string) {
    if (this.providers[chain]) return this.providers[chain];
    const rpc = chain === 'aurora' ? process.env.AURORA_RPC : process.env.ARBITRUM_RPC;
    const p = new ethers.JsonRpcProvider(rpc);
    this.providers[chain] = p;
    return p;
  }

  getWallet(chain: string) {
    const pk = process.env.EVM_PRIVATE_KEY || '';
    const provider = this.getProvider(chain);
    return new ethers.Wallet(pk, provider);
  }

  // placeholder: a method to call a contract (e.g., to execute settlement via relayer)
  async sendRawTx(chain: string, rawTx: string) {
    const provider = this.getProvider(chain);
    return provider.broadcastTransaction(rawTx);
  }
}
