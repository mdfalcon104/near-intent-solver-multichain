import { ConfigService } from '../config/config.service';
import { ChainKeysService } from './chain-keys.service';
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
export declare class Nep413SignerService {
    private readonly configService;
    private readonly chainKeysService;
    private readonly logger;
    private readonly defuseContract;
    private readonly nearAccountId;
    private nearKeyPair;
    private usedNonces;
    constructor(configService: ConfigService, chainKeysService: ChainKeysService);
    private generateNonce;
    private base64ToUint8Array;
    private serializeIntent;
    private signMessage;
    createSignedQuote(quoteId: string, params: QuoteParams, calculatedAmount: string): Promise<SignedQuote>;
}
export {};
