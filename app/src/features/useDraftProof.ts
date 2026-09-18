import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentAccount, useCurrentClient, useCurrentNetwork, useDAppKit } from '@mysten/dapp-kit-react';
import type { SuiClientTypes } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import { api } from '../api/client';
import { config } from '../config';
import type { AgentDescriptor, BountyResponse, ObjectId } from '../domain';

type Notice = { kind: 'success' | 'error' | 'info'; message: string } | null;
export interface TxReceipt {
  digest: string;
  events: Array<Pick<SuiClientTypes.Event, 'eventType' | 'json'>>;
  objectIds: ObjectId[];
  effects: { changedObjects: Array<Pick<SuiClientTypes.ChangedObject, 'objectId' | 'idOperation'>> } | null;
  objectTypes: Record<string, string>;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'Unexpected request failure.'; }
function transactionError(error: unknown): string { if (typeof error === 'string') return error; if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message; return 'Sui rejected the transaction.'; }
function objectId(value: unknown): ObjectId | null { return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() as ObjectId : null; }

function eventType(packageId: ObjectId, name: string): string { return `${packageId}::databounty::${name}`; }

function eventFieldId(event: Pick<SuiClientTypes.Event, 'eventType' | 'json'>, field: string): ObjectId | null {
  const json = event.json;
  if (!json) return null;
  const value = json[field] ?? json[field.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())];
  return objectId(value);
}

/** Decode one object ID from the exact Move event, with an exact typed-object fallback. */
export function decodeTransactionObjectId(receipt: TxReceipt, packageId: ObjectId, eventName: 'BountyCreated' | 'SubmissionReserved', field: 'bounty_id' | 'submission_id', objectName: 'Bounty' | 'Submission'): ObjectId {
  const expectedEventType = eventType(packageId, eventName);
  const matchingEvents = receipt.events.filter((event) => event.eventType === expectedEventType);
  if (matchingEvents.length > 1) throw new Error(`Ambiguous ${eventName} events in transaction ${receipt.digest}.`);
  const fromEvent = matchingEvents.length === 1 ? eventFieldId(matchingEvents[0], field) : null;
  if (fromEvent) return fromEvent;

  const expectedObjectType = eventType(packageId, objectName);
  const candidates = [...new Set((receipt.effects?.changedObjects ?? [])
    .filter((change) => change.idOperation === 'Created')
    .map((change) => {
      const id = objectId(change.objectId);
      if (!id) return null;
      const type = receipt.objectTypes[change.objectId] ?? receipt.objectTypes[id];
      return type === expectedObjectType ? id : null;
    })
    .filter((id): id is ObjectId => id !== null))];
  if (candidates.length > 1) throw new Error(`Ambiguous created ${objectName} objects in transaction ${receipt.digest}.`);
  if (candidates.length === 1) return candidates[0];
  throw new Error(`Transaction ${receipt.digest} did not include a valid ${expectedEventType} event or exact created ${expectedObjectType} object.`);
}

export function decodeBountyCreatedId(receipt: TxReceipt, packageId: ObjectId): ObjectId {
  return decodeTransactionObjectId(receipt, packageId, 'BountyCreated', 'bounty_id', 'Bounty');
}

export function decodeSubmissionReservedId(receipt: TxReceipt, packageId: ObjectId): ObjectId {
  return decodeTransactionObjectId(receipt, packageId, 'SubmissionReserved', 'submission_id', 'Submission');
}

export function useDataBounty() {
  const account = useCurrentAccount(); const network = useCurrentNetwork(); const dAppKit = useDAppKit(); const client = useCurrentClient();
  const [data, setData] = useState<BountyResponse | null>(null); const [notice, setNotice] = useState<Notice>(null); const [busy, setBusy] = useState<string | null>(null); const [authenticatedAddress, setAuthenticatedAddress] = useState<string | null>(null); const [agents, setAgents] = useState<AgentDescriptor[]>([]);
  const sessionValid = account?.address === authenticatedAddress;
  const ready = useMemo(() => ({ wallet: !config.isPublicPreview && Boolean(account), network: !config.isPublicPreview && network === 'testnet', package: !config.isPublicPreview && Boolean(config.packageId), session: !config.isPublicPreview && sessionValid }), [account, network, sessionValid]);
  const previewError = () => new Error('This public preview is read-only. Run the local app for wallet and API actions.');
  const authenticate = useCallback(async () => { if (config.isPublicPreview) throw previewError(); if (!account) throw new Error('Connect a Sui wallet first.'); if (network !== 'testnet') throw new Error('Switch the wallet to Sui Testnet first.'); setBusy('auth'); try { const challenge = await api.challenge(account.address as `0x${string}`); const { signature } = await dAppKit.signPersonalMessage({ message: new TextEncoder().encode(challenge.message) }); if (!signature) throw new Error('Wallet did not return a personal-message signature.'); const verified = await api.verify(challenge.challengeId, challenge.message, signature); setAuthenticatedAddress(verified.address); setNotice({ kind: 'success', message: 'Wallet signature verified for this browser session.' }); return verified.address; } catch (error) { setNotice({ kind: 'error', message: errorMessage(error) }); throw error; } finally { setBusy(null); } }, [account, dAppKit, network]);
  const loadBounty = useCallback(async (bountyId: ObjectId) => { if (config.isPublicPreview) throw previewError(); setBusy('load'); try { const next = await api.bounty(bountyId); setData(next); setNotice({ kind: 'success', message: `Loaded ${next.submissions.length} submission${next.submissions.length === 1 ? '' : 's'} from checkpoint ${next.bounty.checkpoint}.` }); return next; } catch (error) { setNotice({ kind: 'error', message: errorMessage(error) }); throw error; } finally { setBusy(null); } }, []);
  const execute = useCallback(async (label: string, transaction: Transaction): Promise<TxReceipt> => { if (config.isPublicPreview) throw previewError(); if (!account) throw new Error('Connect a Sui wallet first.'); if (network !== 'testnet') throw new Error('Switch the wallet to Sui Testnet before signing.'); if (!config.packageId) throw new Error('Set VITE_DATABOUNTY_PACKAGE_ID before signing.'); setBusy(label); try { const submitted = await dAppKit.signAndExecuteTransaction({ transaction }); if (submitted.$kind === 'FailedTransaction') throw new Error(transactionError(submitted.FailedTransaction.status.error)); const digest = submitted.Transaction.digest; const settled = await client.core.waitForTransaction({ digest, include: { events: true, effects: true, objectTypes: true } }); if (settled.$kind === 'FailedTransaction') throw new Error(transactionError(settled.FailedTransaction.status.error)); const txResult = settled.Transaction; const events = txResult.events ?? []; const effects = txResult.effects ?? null; const objectTypes = txResult.objectTypes ?? {}; const objectIds = (effects?.changedObjects ?? []).filter((change) => change.idOperation === 'Created').map((change) => objectId(change.objectId)).filter((value): value is ObjectId => value !== null); setNotice({ kind: 'success', message: `${label} confirmed · ${digest.slice(0, 12)}…` }); return { digest, events, objectIds, effects, objectTypes }; } catch (error) { setNotice({ kind: 'error', message: errorMessage(error) }); throw error; } finally { setBusy(null); } }, [account, client, dAppKit, network]);
  const signPersonalMessage = useCallback(async (bytes: Uint8Array): Promise<string> => { if (config.isPublicPreview) throw previewError(); if (!account) throw new Error('Connect a Sui wallet first.'); const { signature } = await dAppKit.signPersonalMessage({ message: bytes }); if (!signature) throw new Error('Wallet did not return a personal-message signature.'); return signature; }, [account, dAppKit]);
  useEffect(() => { if (account?.address !== authenticatedAddress) setAuthenticatedAddress(null); }, [account?.address, authenticatedAddress]);
  useEffect(() => { if (config.isPublicPreview) return; void api.agents().then((response) => setAgents(response.agents)).catch(() => setAgents([])); }, []);
  const reviewerAddress = agents.find((agent) => agent.role === 'reviewer')?.delegateAddress ?? null;
  return { account, network, data, bounty: data?.bounty ?? null, submissions: data?.submissions ?? [], agents, reviewerAddress, notice, busy, ready, authenticate, loadBounty, execute, signPersonalMessage, setNotice, refresh: data ? () => loadBounty(data.bounty.id) : undefined };
}

/** Compatibility name for integrations that still import the old hook. */
export const useDraftProof = useDataBounty;
