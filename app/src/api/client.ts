import type { AgentDescriptor, ApiErrorResponse, BountyResponse, ObjectId, ReviewResponse, ReviewStatusResponse, SuiAddress, StoragePublishResponse } from '../domain';
import { config } from '../config';
export class ApiError extends Error { constructor(public readonly code: string, message: string, public readonly retryable = false) { super(message); } }
function url(path: string): string { return `${config.apiBaseUrl}${path}`; }
async function request<T>(path: string, options: RequestInit = {}): Promise<T> { if (config.isPublicPreview) throw new ApiError('PUBLIC_PREVIEW', 'The public preview does not connect to the API. Run the local app for live data.'); const response = await fetch(url(path), { credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers }, ...options }); const body = await response.json().catch(() => null) as T | ApiErrorResponse | null; if (!response.ok) { const failure = body as ApiErrorResponse | null; throw new ApiError(failure?.error?.code ?? 'NETWORK_ERROR', failure?.error?.message ?? `Request failed (${response.status}).`, failure?.error?.retryable ?? false); } return body as T; }
export interface AuthChallenge { challengeId: string; message: string; network: 'testnet'; expiresAt: string; }
export interface Health { status: 'ok' | 'degraded' | 'blocked'; network: 'testnet'; packageConfigured: boolean; dependencies: Record<string, 'ok' | 'degraded' | 'blocked'>; }
export interface AgentsResponse { agents: AgentDescriptor[]; }
export const api = {
  health: () => request<Health>('/api/health'),
  agents: () => request<AgentsResponse>('/api/agents'),
  challenge: (address: SuiAddress) => request<AuthChallenge>('/api/auth/challenge', { method: 'POST', body: JSON.stringify({ address }) }),
  verify: (challengeId: string, message: string, signature: string) => request<{ address: SuiAddress; network: 'testnet'; expiresAt: string }>('/api/auth/verify', { method: 'POST', body: JSON.stringify({ challengeId, message, signature }) }),
  bounty: (bountyId: ObjectId) => request<BountyResponse>(`/api/bounties/${bountyId}`),
  publish: (bountyId: ObjectId, submissionId: ObjectId, ciphertext: Uint8Array, ciphertextDigest: string) => request<StoragePublishResponse>('/api/storage/publish', { method: 'POST', body: JSON.stringify({ bountyId, submissionId, ciphertextBase64: toBase64(ciphertext), ciphertextDigest }) }),
  review: (bountyId: ObjectId, body: { requestId: string; submissionId: ObjectId; comparisonSubmissionIds: ObjectId[] }) => request<ReviewResponse>(`/api/bounties/${bountyId}/reviews`, { method: 'POST', body: JSON.stringify(body) }),
  reviewStatus: (bountyId: ObjectId, requestId: string) => request<ReviewStatusResponse>(`/api/bounties/${bountyId}/reviews/${requestId}`),
};
function toBase64(bytes: Uint8Array): string { let value = ''; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value); }
