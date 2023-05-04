import {
    AccountAddress,
    AccountTransaction,
    AccountTransactionHeader,
    AccountTransactionType,
    buildBasicAccountSigner,
    signTransaction,
    TransactionExpiry,
    createConcordiumClient,
    ConfigureDelegationPayload,
    CcdAmount,
    unwrap,
    HexString,
} from '@concordium/node-sdk';
import { credentials } from '@grpc/grpc-js';
import { readFileSync } from 'node:fs';

import meow from 'meow';

const cli = meow(
    `
  Usage
    $ yarn ts-node <path-to-this-file> [options]

  Required
    --wallet-file, -w  The filepath to the sender's private key

  Options
    --help,     -h  Displays this message
    --endpoint, -e  Specify endpoint of the form "address:port", defaults to localhost:20000
`,
    {
        importMeta: import.meta,
        flags: {
            walletFile: {
                type: 'string',
                alias: 'w',
                isRequired: true,
            },
            endpoint: {
                type: 'string',
                alias: 'e',
                default: 'localhost:20000',
            },
        },
    }
);

const [address, port] = cli.flags.endpoint.split(':');
const client = createConcordiumClient(
    address,
    Number(port),
    credentials.createInsecure()
);

/**
 * The following example demonstrates how a configure delegation transaction can be created.
 * Note that although all the fields are optional, they are all required, when becoming a delegator.
 */

(async () => {
    // Read wallet-file
    const walletFile = JSON.parse(readFileSync(cli.flags.walletFile, 'utf8'));
    const sender = new AccountAddress(unwrap(walletFile.value.address));
    const senderPrivateKey: HexString = unwrap(
        walletFile.value.accountKeys.keys[0].keys[0].signKey
    );

    const header: AccountTransactionHeader = {
        expiry: new TransactionExpiry(new Date(Date.now() + 3600000)),
        nonce: (await client.getNextAccountNonce(sender)).nonce,
        sender: sender,
    };

    const configureDelegationPayload: ConfigureDelegationPayload = {
        stake: new CcdAmount(0n),
    };

    const configureDelegationTransaction: AccountTransaction = {
        header: header,
        payload: configureDelegationPayload,
        type: AccountTransactionType.ConfigureDelegation,
    };

    // Sign transaction
    const signer = buildBasicAccountSigner(senderPrivateKey);
    const signature = await signTransaction(
        configureDelegationTransaction,
        signer
    );

    const transactionHash = await client.sendAccountTransaction(
        configureDelegationTransaction,
        signature
    );

    console.log('Transaction submitted, waiting for finalization...');
    await client.waitForTransactionFinalization(transactionHash);

    console.log('Transaction finalized, getting outcome...\n');

    const transactionStatus = await client.getBlockItemStatus(transactionHash);

    if (transactionStatus.status === 'finalized') {
        console.dir(transactionStatus.outcome, { depth: null, colors: true });
    }
})();
