import { normalizeObjectId, type ObjectId } from './domain';

export const DEFAULT_TESTNET_CONFIG = {
  sealServerIds: '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98',
  sealAggregatorUrl: 'https://seal-aggregator-testnet.mystenlabs.com',
  walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
} as const;

export type PublicMode = 'local' | 'preview';

function publicMode(value: string | undefined): PublicMode {
  return value === 'preview' ? 'preview' : 'local';
}

function configuredObjectId(value: string | undefined): ObjectId | null {
  if (!value) return null;
  try {
    return normalizeObjectId(value);
  } catch {
    return null;
  }
}

export function createConfig(environment: Record<string, string | undefined> = import.meta.env) {
  const mode = publicMode(environment.VITE_PUBLIC_MODE);
  return {
    publicMode: mode,
    isPublicPreview: mode === 'preview',
    apiBaseUrl: environment.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '',
    network: environment.VITE_SUI_NETWORK ?? 'testnet',
    grpcUrl: environment.VITE_SUI_GRPC_URL ?? 'https://fullnode.testnet.sui.io:443',
    // The DataBounty package is deliberately opt-in. Never fall back to DraftProof.
    packageId: configuredObjectId(environment.VITE_DATABOUNTY_PACKAGE_ID),
    sealServerIds: String(environment.VITE_SEAL_KEY_SERVER_IDS ?? DEFAULT_TESTNET_CONFIG.sealServerIds)
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean)
      .map(configuredObjectId)
      .filter((value: ObjectId | null): value is ObjectId => value !== null),
    sealAggregatorUrl: environment.VITE_SEAL_AGGREGATOR_URL ?? DEFAULT_TESTNET_CONFIG.sealAggregatorUrl,
    walrusAggregatorUrl: environment.VITE_WALRUS_AGGREGATOR_URL ?? DEFAULT_TESTNET_CONFIG.walrusAggregatorUrl,
  };
}

export const config = createConfig();

export function getIntegrationReadiness(currentConfig = config) {
  return {
    package: !currentConfig.isPublicPreview && currentConfig.packageId !== null,
    seal: !currentConfig.isPublicPreview && currentConfig.packageId !== null && currentConfig.sealServerIds.length > 0 && Boolean(currentConfig.sealAggregatorUrl),
    walrus: !currentConfig.isPublicPreview && Boolean(currentConfig.walrusAggregatorUrl),
  };
}

export const integrationReadiness = getIntegrationReadiness();
