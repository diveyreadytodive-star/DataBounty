import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { config } from '../config';

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: config.grpcUrl }),
  // Public Vercel builds must never restore or prompt for a wallet session.
  autoConnect: !config.isPublicPreview,
  storage: localStorage,
  storageKey: 'databounty-wallet',
});

declare module '@mysten/dapp-kit-react' {
  interface Register { dAppKit: typeof dAppKit; }
}
