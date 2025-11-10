"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EvmService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvmService = void 0;
const common_1 = require("@nestjs/common");
const ethers_1 = require("ethers");
let EvmService = EvmService_1 = class EvmService {
    constructor() {
        this.logger = new common_1.Logger(EvmService_1.name);
        this.providers = {};
        this.wallets = {};
        this.RPC_ENDPOINTS = {
            arbitrum: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
            aurora: process.env.AURORA_RPC || 'https://mainnet.aurora.dev',
            ethereum: process.env.ETHEREUM_RPC || 'https://eth.rpc.blxrbdn.com',
            polygon: process.env.POLYGON_RPC || 'https://polygon-rpc.com',
            base: process.env.BASE_RPC || 'https://mainnet.base.org',
            optimism: process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io',
        };
        this.ERC20_ABI = [
            'function transfer(address to, uint256 amount) returns (bool)',
            'function approve(address spender, uint256 amount) returns (bool)',
            'function balanceOf(address account) returns (uint256)',
            'function decimals() returns (uint8)',
        ];
    }
    getProvider(chain) {
        if (this.providers[chain])
            return this.providers[chain];
        const rpc = this.RPC_ENDPOINTS[chain.toLowerCase()];
        if (!rpc) {
            throw new Error(`No RPC endpoint configured for chain: ${chain}`);
        }
        const p = new ethers_1.ethers.JsonRpcProvider(rpc);
        this.providers[chain] = p;
        return p;
    }
    getWallet(chain) {
        if (this.wallets[chain])
            return this.wallets[chain];
        const pk = process.env.EVM_PRIVATE_KEY || '';
        if (!pk) {
            throw new Error('EVM_PRIVATE_KEY not configured');
        }
        const provider = this.getProvider(chain);
        const wallet = new ethers_1.ethers.Wallet(pk, provider);
        this.wallets[chain] = wallet;
        return wallet;
    }
    async buildAndSignDepositTx(chain, tokenAddress, recipientAddress, amount) {
        this.logger.log(`[EVM] Building signed deposit transaction on ${chain}...`);
        this.logger.log(`  Token: ${tokenAddress}`);
        this.logger.log(`  Recipient: ${recipientAddress}`);
        this.logger.log(`  Amount: ${amount}`);
        try {
            const wallet = this.getWallet(chain);
            const provider = this.getProvider(chain);
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers_1.ethers.parseUnits('1', 'gwei');
            const erc20 = new ethers_1.ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
            const tx = await erc20.transfer.populateTransaction(recipientAddress, amount);
            const nonce = await provider.getTransactionCount(wallet.address);
            tx.from = wallet.address;
            tx.gasPrice = gasPrice;
            const gasEstimate = await provider.estimateGas(tx);
            const gasLimit = (gasEstimate * 120n) / 100n;
            tx.gasLimit = gasLimit;
            tx.nonce = nonce;
            const signedTx = await wallet.signTransaction(tx);
            this.logger.log(`[EVM] Deposit transaction signed`);
            this.logger.log(`  From: ${wallet.address}`);
            this.logger.log(`  To: ${tx.to}`);
            this.logger.log(`  Gas Limit: ${gasLimit.toString()}`);
            this.logger.log(`  Nonce: ${nonce}`);
            return {
                signedTx,
                from: wallet.address,
                to: tx.to || '',
                data: tx.data || '0x',
                value: tx.value?.toString() || '0',
                gasLimit: gasLimit.toString(),
                gasPrice: gasPrice.toString(),
                nonce,
            };
        }
        catch (error) {
            this.logger.error(`[EVM] Failed to build deposit transaction: ${error}`);
            throw error;
        }
    }
    async buildAndSignWithdrawTx(chain, recipientAddress, amount, tokenAddress) {
        this.logger.log(`[EVM] Building signed withdrawal transaction on ${chain}...`);
        this.logger.log(`  Recipient: ${recipientAddress}`);
        this.logger.log(`  Amount: ${amount}`);
        if (tokenAddress) {
            this.logger.log(`  Token: ${tokenAddress}`);
        }
        try {
            const wallet = this.getWallet(chain);
            const provider = this.getProvider(chain);
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers_1.ethers.parseUnits('1', 'gwei');
            const nonce = await provider.getTransactionCount(wallet.address);
            let tx;
            if (!tokenAddress) {
                tx = {
                    to: recipientAddress,
                    from: wallet.address,
                    value: amount,
                    data: '0x',
                    gasPrice,
                    nonce,
                };
                const gasEstimate = await provider.estimateGas(tx);
                const gasLimit = (gasEstimate * 120n) / 100n;
                tx.gasLimit = gasLimit;
            }
            else {
                const erc20 = new ethers_1.ethers.Contract(tokenAddress, this.ERC20_ABI, wallet);
                tx = await erc20.transfer.populateTransaction(recipientAddress, amount);
                tx.from = wallet.address;
                tx.gasPrice = gasPrice;
                tx.nonce = nonce;
                const gasEstimate = await provider.estimateGas(tx);
                const gasLimit = (gasEstimate * 120n) / 100n;
                tx.gasLimit = gasLimit;
            }
            const signedTx = await wallet.signTransaction(tx);
            this.logger.log(`[EVM] Withdrawal transaction signed`);
            this.logger.log(`  From: ${wallet.address}`);
            this.logger.log(`  To: ${tx.to}`);
            this.logger.log(`  Gas Limit: ${tx.gasLimit.toString()}`);
            this.logger.log(`  Nonce: ${nonce}`);
            return {
                signedTx,
                from: wallet.address,
                to: tx.to,
                data: tx.data || '0x',
                value: tx.value?.toString() || '0',
                gasLimit: tx.gasLimit.toString(),
                gasPrice: gasPrice.toString(),
                nonce,
            };
        }
        catch (error) {
            this.logger.error(`[EVM] Failed to build withdrawal transaction: ${error}`);
            throw error;
        }
    }
    async broadcastSignedTx(chain, signedTx) {
        this.logger.log(`[EVM] Broadcasting signed transaction on ${chain}...`);
        try {
            const provider = this.getProvider(chain);
            const txResponse = await provider.broadcastTransaction(signedTx);
            this.logger.log(`[EVM] Transaction broadcasted`);
            this.logger.log(`  TX Hash: ${txResponse.hash}`);
            this.logger.log(`  From: ${txResponse.from}`);
            this.logger.log(`  To: ${txResponse.to}`);
            const receipt = await txResponse.wait(1);
            if (!receipt) {
                throw new Error('Transaction failed to confirm');
            }
            return {
                txHash: txResponse.hash,
                from: txResponse.from || '',
                to: txResponse.to || '',
                blockNumber: receipt.blockNumber,
            };
        }
        catch (error) {
            this.logger.error(`[EVM] Failed to broadcast transaction: ${error}`);
            throw error;
        }
    }
    async depositAndSign(chain, tokenAddress, recipientAddress, amount) {
        this.logger.log(`[EVM] Executing deposit with signature on ${chain}...`);
        try {
            const txData = await this.buildAndSignDepositTx(chain, tokenAddress, recipientAddress, amount);
            const result = await this.broadcastSignedTx(chain, txData.signedTx);
            return {
                status: 'success',
                txHash: result.txHash,
                from: result.from,
                to: result.to,
                amount,
                chain,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            this.logger.error(`[EVM] Deposit failed: ${error}`);
            throw error;
        }
    }
    async withdrawAndSign(chain, recipientAddress, amount, tokenAddress) {
        this.logger.log(`[EVM] Executing withdrawal with signature on ${chain}...`);
        try {
            const txData = await this.buildAndSignWithdrawTx(chain, recipientAddress, amount, tokenAddress);
            const result = await this.broadcastSignedTx(chain, txData.signedTx);
            return {
                status: 'success',
                txHash: result.txHash,
                from: result.from,
                to: result.to,
                amount,
                chain,
                timestamp: Date.now(),
            };
        }
        catch (error) {
            this.logger.error(`[EVM] Withdrawal failed: ${error}`);
            throw error;
        }
    }
    async sendRawTx(chain, rawTx) {
        const provider = this.getProvider(chain);
        return provider.broadcastTransaction(rawTx);
    }
};
exports.EvmService = EvmService;
exports.EvmService = EvmService = EvmService_1 = __decorate([
    (0, common_1.Injectable)()
], EvmService);
//# sourceMappingURL=evm.service.js.map