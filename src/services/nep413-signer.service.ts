import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { BorshSchema, borshSerialize } from 'borsher';
import bs58 from 'bs58';
import * as crypto from 'crypto';
import { KeyPair } from 'near-api-js';
import { ChainKeysService } from './chain-keys.service';

const standardNumber = {
  nep413: 413,
};

const Nep413PayloadSchema = BorshSchema.Struct({
  message: BorshSchema.String,
  nonce: BorshSchema.Array(BorshSchema.u8, 32),
  recipient: BorshSchema.String,
  callback_url: BorshSchema.Option(BorshSchema.String),
});

interface QuoteParams {
  defuse_asset_identifier_in: string;
  defuse_asset_identifier_out: string;
  exact_amount_in?: string;
  exact_amount_out?: string;
  min_deadline_ms: number;
}

interface SignedQuote {
  quote_id: string;
  quote_output: {
    amount_in?: string;
    amount_out?: string;
  };
  signed_data: {
    standard: string;
    payload: {
      message: string;
      nonce: string;
      recipient: string;
    };
    signature: string;
    public_key: string;
  };
}

@Injectable()
export class Nep413SignerService {
  private readonly logger = new Logger(Nep413SignerService.name);
  private readonly defuseContract: string;
  private readonly nearAccountId: string;
  private nearKeyPair: KeyPair;
  private usedNonces: Set<string> = new Set();

  constructor(
    private readonly configService: ConfigService,
    private readonly chainKeysService: ChainKeysService,
  ) {
    this.defuseContract =
      this.configService.get('DEFUSE_CONTRACT') || 'intents.near';
    this.nearAccountId = this.configService.get('NEAR_ACCOUNT_ID');

    if (!this.nearAccountId) {
      this.logger.warn(
        'NEAR_ACCOUNT_ID not configured. NEP-413 signing will not work.',
      );
    }

    // Get NEAR private key and create KeyPair
    const nearPrivateKey = this.configService.get('CHAIN_NEAR_PRIVATE_KEY');
    if (nearPrivateKey) {
      try {
        this.nearKeyPair = KeyPair.fromString(nearPrivateKey);
        this.logger.log(
          `Initialized NEP-413 signer for account: ${this.nearAccountId}`,
        );
      } catch (error) {
        this.logger.error('Failed to parse NEAR private key', error);
      }
    }
  }

  /**
   * Generate a unique nonce for signing
   */
  private async generateNonce(): Promise<string> {
    const randomArray = crypto.randomBytes(32);
    const nonceString = randomArray.toString('base64');

    // Simple nonce check (in production, check against NEAR contract)
    if (this.usedNonces.has(nonceString)) {
      return this.generateNonce();
    }

    this.usedNonces.add(nonceString);
    return nonceString;
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = Buffer.from(base64, 'base64').toString('binary');
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Serialize intent message for signing
   */
  private serializeIntent(
    intentMessage: string,
    recipient: string,
    nonce: string,
    standard: string,
  ): Buffer {
    const nonceArray = Array.from(this.base64ToUint8Array(nonce));
    const payload = {
      message: intentMessage,
      nonce: nonceArray,
      recipient,
      callback_url: null,
    };

    const payloadSerialized = borshSerialize(Nep413PayloadSchema, payload);
    const baseInt = 2 ** 31 + standardNumber[standard];
    const baseIntSerialized = borshSerialize(BorshSchema.u32, baseInt);
    const combinedData = Buffer.concat([baseIntSerialized, payloadSerialized]);

    return crypto.createHash('sha256').update(combinedData).digest();
  }

  /**
   * Sign message with NEAR key pair
   */
  private async signMessage(message: Uint8Array): Promise<{
    signature: Uint8Array;
    publicKey: Uint8Array;
  }> {
    if (!this.nearKeyPair) {
      throw new Error('NEAR KeyPair not initialized');
    }

    const sig = this.nearKeyPair.sign(message);
    return {
      signature: sig.signature,
      publicKey: this.nearKeyPair.getPublicKey().data,
    };
  }

  /**
   * Create a signed quote for a quote request
   */
  async createSignedQuote(
    quoteId: string,
    params: QuoteParams,
    calculatedAmount: string,
  ): Promise<SignedQuote> {
    if (!this.nearAccountId || !this.nearKeyPair) {
      throw new Error('NEAR account not configured for signing');
    }

    const standard = 'nep413';

    // Calculate deadline (current time + min_deadline_ms)
    const deadlineTimestamp = Math.floor(
      (Date.now() + params.min_deadline_ms) / 1000,
    );

    // Create intent message
    const message = {
      signer_id: this.nearAccountId,
      deadline: {
        timestamp: deadlineTimestamp,
      },
      intents: [
        {
          intent: 'token_diff',
          diff: {
            [params.defuse_asset_identifier_in]: params.exact_amount_in
              ? params.exact_amount_in
              : calculatedAmount,
            [params.defuse_asset_identifier_out]: `-${
              params.exact_amount_out ? params.exact_amount_out : calculatedAmount
            }`,
          },
        },
      ],
    };

    const messageStr = JSON.stringify(message);
    const nonce = await this.generateNonce();
    const recipient = this.defuseContract;

    // Serialize and sign
    const quoteHash = this.serializeIntent(messageStr, recipient, nonce, standard);
    const signature = await this.signMessage(quoteHash);

    // Build response
    const resp: SignedQuote = {
      quote_id: quoteId,
      quote_output: {},
      signed_data: {
        standard,
        payload: {
          message: messageStr,
          nonce,
          recipient,
        },
        signature: `ed25519:${bs58.encode(signature.signature)}`,
        public_key: `ed25519:${bs58.encode(signature.publicKey)}`,
      },
    };

    if (!params.exact_amount_in) {
      resp.quote_output.amount_in = calculatedAmount;
    } else {
      resp.quote_output.amount_out = calculatedAmount;
    }

    this.logger.log(
      `Created signed quote ${quoteId} for ${calculatedAmount} tokens`,
    );

    return resp;
  }
}
