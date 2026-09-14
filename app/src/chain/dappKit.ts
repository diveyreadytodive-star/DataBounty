import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { config } from '../config';

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: config.grpcUrl }),
  autoConnect: true,
  storage: localStorage,
  storageKey: 'databounty-wallet',
});

declare module '@mysten/dapp-kit-react' {
  interface Register { dAppKit: typeof dAppKit; }
}
