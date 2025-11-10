import { Injectable } from '@nestjs/common';
import { connect, keyStores, KeyPair } from 'near-api-js';

@Injectable()
export class NearService {
  private account: any;

  async init() {
    if (this.account) return;
    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(process.env.NEAR_PRIVATE_KEY);
    await keyStore.setKey(
      process.env.NEAR_NETWORK,
      process.env.NEAR_ACCOUNT_ID,
      keyPair
    );

    const near = await connect({
      networkId: process.env.NEAR_NETWORK,
      nodeUrl: process.env.NEAR_NODE_URL,
      deps: { keyStore },
    });

    this.account = await near.account(process.env.NEAR_ACCOUNT_ID);
  }

  async executeIntent(method: string, args: any) {
    if (!this.account) await this.init();
    return this.account.functionCall({
      contractId: process.env.VERIFIER_CONTRACT,
      methodName: method,
      args,
      gas: '100000000000000',
      attachedDeposit: '0',
    });
  }

  async viewFunction(contractId: string, methodName: string, args: any) {
    if (!this.account) await this.init();
    // near-api-js viewFunction via account.viewFunction isn't available; using provider
    return (this.account.connection.provider as any).query({
      request_type: 'call_function',
      account_id: contractId,
      method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      finality: 'optimistic',
    });
  }
}
