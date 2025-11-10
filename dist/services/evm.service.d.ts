import { ethers } from 'ethers';
export declare class EvmService {
    private providers;
    getProvider(chain: string): ethers.JsonRpcProvider;
    getWallet(chain: string): ethers.Wallet;
    sendRawTx(chain: string, rawTx: string): Promise<ethers.TransactionResponse>;
}
