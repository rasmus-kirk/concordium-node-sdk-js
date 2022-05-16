import { Buffer } from 'buffer/';
import {
    AccountTransaction,
    AccountTransactionSignature,
    NextAccountNonce,
    TransactionStatus,
} from './types';
import { AccountAddress } from './types/accountAddress';
import Provider from './providers/provider';
import { serializeAccountTransactionForSubmission } from './serialization';

export class JsonRpcClient {
    provider: Provider;

    constructor(provider: Provider) {
        this.provider = provider;
    }

    async getNextAccountNonce(
        accountAddress: AccountAddress
    ): Promise<NextAccountNonce | undefined> {
        const res = await this.provider.request('getNextAccountNonce', {
            address: accountAddress.address,
        });
        if (res.error) {
            throw new Error(res.error.code + ': ' + res.error.message);
        } else if (res.result) {
            return {
                nonce: BigInt(res.result.nonce),
                allFinal: res.result.allFinal,
            };
        }
        return undefined;
    }

    async getTransactionStatus(
        transactionHash: string
    ): Promise<TransactionStatus | undefined> {
        const res = await this.provider.request('getTransactionStatus', {
            transactionHash: transactionHash,
        });

        if (res.error) {
            throw new Error(res.error.code + ': ' + res.error.message);
        } else if (res.result) {
            return res.result;
        }
        return undefined;
    }

    async sendAccountTransaction(
        accountTransaction: AccountTransaction,
        signatures: AccountTransactionSignature
    ): Promise<boolean> {
        const serializedAccountTransaction: Buffer = Buffer.from(
            serializeAccountTransactionForSubmission(
                accountTransaction,
                signatures
            )
        );

        const res = await this.provider.request('sendAccountTransaction', {
            transaction: serializedAccountTransaction.toString('base64'),
        });

        if (res.error) {
            throw new Error(res.error.code + ': ' + res.error.message);
        } else if (res.result) {
            return res.result;
        }
        return false;
    }
}
