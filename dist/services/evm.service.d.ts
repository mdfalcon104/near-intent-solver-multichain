import { ethers } from 'ethers';
export declare class EvmService {
    private readonly logger;
    private providers;
    private wallets;
    private readonly RPC_ENDPOINTS;
    private readonly ERC20_ABI;
    getProvider(chain: string): ethers.JsonRpcProvider;
    getWallet(chain: string): ethers.Wallet;
    buildAndSignDepositTx(chain: string, tokenAddress: string, recipientAddress: string, amount: string): Promise<{
        signedTx: string;
        from: string;
        to: string;
        data: string;
        value: string;
        gasLimit: string;
        gasPrice: string;
        nonce: number;
    }>;
    buildAndSignWithdrawTx(chain: string, recipientAddress: string, amount: string, tokenAddress?: string): Promise<{
        signedTx: string;
        from: string;
        to: string;
        data: string;
        value: string;
        gasLimit: string;
        gasPrice: string;
        nonce: number;
    }>;
    broadcastSignedTx(chain: string, signedTx: string): Promise<{
        txHash: string;
        from: string;
        to: string;
        blockNumber: number;
    }>;
    depositAndSign(chain: string, tokenAddress: string, recipientAddress: string, amount: string): Promise<{
        status: string;
        txHash: string;
        from: string;
        to: string;
        amount: string;
        chain: string;
        timestamp: number;
    }>;
    withdrawAndSign(chain: string, recipientAddress: string, amount: string, tokenAddress?: string): Promise<{
        status: string;
        txHash: string;
        from: string;
        to: string;
        amount: string;
        chain: string;
        timestamp: number;
    }>;
    sendRawTx(chain: string, rawTx: string): Promise<ethers.TransactionResponse>;
}
