import { createConcordiumClient } from '@concordium/node-sdk';
import { credentials } from '@grpc/grpc-js';

import meow from 'meow';

const cli = meow(
    `
  Usage
    $ yarn run-example <path-to-this-file> [options]

  Required
    --ip, -i  The ip of the peer to ban.

  Options
    --help,         Displays this message
    --endpoint, -e  Specify endpoint of the form "address:port", defaults to localhost:20000
`,
    {
        importMeta: import.meta,
        flags: {
            ip: {
                type: 'string',
                alias: 'i',
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

// Split endpoint on last colon
const lastColonIndex = cli.flags.endpoint.lastIndexOf(':');
const address = cli.flags.endpoint.substring(0, lastColonIndex);
const port = cli.flags.endpoint.substring(lastColonIndex + 1);

const client = createConcordiumClient(
    address,
    Number(port),
    credentials.createInsecure()
);

/**
 * Bans the specified peer.
 * Rejects if the action fails.
 */

(async () => {
    await client.banPeer(cli.flags.ip);
    console.log('Specified peer successfully banned');
})();
