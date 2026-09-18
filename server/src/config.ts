import type { AgentRole, ObjectId, SuiAddress } from './api/types.js';
import { address, objectId } from './validation.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';

export interface Config {
  nodeEnv: 'development' | 'test' | 'production'; host: string; port: number; appOrigin: string; authDomain: string;
  nonceTtlSeconds: number; sessionTtlSeconds: number; cookieSecret: string; sqlitePath: string; logLevel: string;
  suiGrpcUrl: string; packageId: ObjectId | undefined; walrusPublisherUrl: string | undefined; walrusAggregatorUrl: string | undefined; walrusStorageEpochs: number;
  sealKeyServerIds: ObjectId[]; sealAggregatorUrl: string | undefined; sealThreshold: number; sealApiKeyName: string | undefined; sealApiKey: string | undefined;
  delegates: Record<AgentRole, { privateKey: string | undefined; address: SuiAddress | undefined }>;
  ai: { provider: string; baseUrl: string; apiKey: string; model: string } | undefined;
}

// Keep local authentication and review metadata in one location even when the
// server is launched from either the repository root or the server workspace.
const DEFAULT_SQLITE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/databounty.db');

function envString(env: NodeJS.ProcessEnv, key: string, fallback?: string): string | undefined { return env[key] ?? fallback; }
function positive(env: NodeJS.ProcessEnv, key: string, fallback: number): number { const value = Number(env[key] ?? fallback); if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${key} must be a positive integer`); return value; }
function url(value: string | undefined, key: string): string | undefined { if (value === undefined || value === '') return undefined; const parsed = new URL(value); if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error(`${key} must be an HTTP(S) URL`); return parsed.origin; }
function apiBaseUrl(value: string | undefined, key: string): string | undefined { if (value === undefined || value === '') return undefined; const parsed = new URL(value); if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error(`${key} must be an HTTP(S) URL`); return parsed.toString().replace(/\/$/, ''); }
function deriveDelegateAddress(privateKey: string, key: string): SuiAddress {
  try {
    const decoded = decodeSuiPrivateKey(privateKey);
    if (decoded.scheme === 'ED25519') return Ed25519Keypair.fromSecretKey(decoded.secretKey).toSuiAddress() as SuiAddress;
    if (decoded.scheme === 'Secp256k1') return Secp256k1Keypair.fromSecretKey(decoded.secretKey).toSuiAddress() as SuiAddress;
    if (decoded.scheme === 'Secp256r1') return Secp256r1Keypair.fromSecretKey(decoded.secretKey).toSuiAddress() as SuiAddress;
    throw new Error('unsupported signing scheme');
  } catch { throw new Error(`${key} is invalid or uses an unsupported signing scheme`); }
}

export function loadConfig(env = process.env): Config {
  const nodeEnv = (env.NODE_ENV ?? 'development') as Config['nodeEnv'];
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV is invalid');
  const appOrigin = url(env.APP_ORIGIN ?? 'http://127.0.0.1:3000', 'APP_ORIGIN');
  if (!appOrigin) throw new Error('APP_ORIGIN is required');
  const packageValue = env.DATABOUNTY_PACKAGE_ID;
  const ids = (env.SEAL_KEY_SERVER_IDS ?? '').split(',').filter(Boolean).map((id) => objectId(id, 'SEAL_KEY_SERVER_IDS'));
  const delegate = (privateKeyKey: string, addressKey: string): { privateKey: string | undefined; address: SuiAddress | undefined } => {
    const privateKey = env[privateKeyKey] || undefined;
    if (!privateKey) return { privateKey: undefined, address: undefined };
    // Derive once at startup so every descriptor and Seal request names the
    // signer that can actually authorize the review.
    const derivedAddress = deriveDelegateAddress(privateKey, privateKeyKey);
    const configuredAddress = env[addressKey] ? address(env[addressKey], addressKey) : undefined;
    if (configuredAddress && configuredAddress.toLowerCase() !== derivedAddress.toLowerCase()) throw new Error(`${addressKey} does not match ${privateKeyKey}`);
    return { privateKey, address: derivedAddress };
  };
  const aiValues = [env.AI_PROVIDER, env.AI_BASE_URL, env.AI_API_KEY, env.AI_MODEL];
  if (aiValues.some(Boolean) && aiValues.some((value) => !value)) throw new Error('AI_PROVIDER, AI_BASE_URL, AI_API_KEY, and AI_MODEL must be set together');
  return {
    nodeEnv, host: env.HOST ?? '127.0.0.1', port: positive(env, 'PORT', 3000), appOrigin,
    authDomain: env.AUTH_DOMAIN ?? new URL(appOrigin).host, nonceTtlSeconds: positive(env, 'AUTH_NONCE_TTL_SECONDS', 300),
    sessionTtlSeconds: positive(env, 'SESSION_TTL_SECONDS', 3600), cookieSecret: env.COOKIE_SECRET ?? 'development-only-change-me',
    sqlitePath: env.SQLITE_PATH ?? DEFAULT_SQLITE_PATH, logLevel: env.LOG_LEVEL ?? 'info',
    suiGrpcUrl: url(env.SUI_GRPC_URL ?? 'https://fullnode.testnet.sui.io:443', 'SUI_GRPC_URL')!, packageId: packageValue ? objectId(packageValue, 'DATABOUNTY_PACKAGE_ID') : undefined,
    walrusPublisherUrl: url(env.WALRUS_PUBLISHER_URL, 'WALRUS_PUBLISHER_URL'), walrusAggregatorUrl: url(env.WALRUS_AGGREGATOR_URL, 'WALRUS_AGGREGATOR_URL'), walrusStorageEpochs: positive(env, 'WALRUS_STORAGE_EPOCHS', 5),
    sealKeyServerIds: ids, sealAggregatorUrl: url(env.SEAL_AGGREGATOR_URL, 'SEAL_AGGREGATOR_URL'), sealThreshold: positive(env, 'SEAL_THRESHOLD', 1),
    sealApiKeyName: envString(env, 'SEAL_API_KEY_NAME'), sealApiKey: envString(env, 'SEAL_API_KEY'),
    delegates: { reviewer: delegate('REVIEWER_DELEGATE_PRIVATE_KEY', 'REVIEWER_DELEGATE_ADDRESS') },
    ai: env.AI_PROVIDER ? { provider: env.AI_PROVIDER, baseUrl: apiBaseUrl(env.AI_BASE_URL, 'AI_BASE_URL')!, apiKey: env.AI_API_KEY!, model: env.AI_MODEL! } : undefined
  };
}
