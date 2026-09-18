import { describe, expect, it } from 'vitest';
import type { SuiClientTypes } from '@mysten/sui/client';
import { decodeBountyCreatedId, decodeSubmissionReservedId, type TxReceipt } from '../src/features/useDraftProof';

const PACKAGE = `0x${'aa'.repeat(32)}` as `0x${string}`;
const BOUNTY = `0x${'11'.repeat(32)}` as `0x${string}`;
const SUBMISSION = `0x${'22'.repeat(32)}` as `0x${string}`;

function receipt(events: TxReceipt['events'] = [], changedObjects: Array<Pick<SuiClientTypes.ChangedObject, 'objectId' | 'idOperation'>> = [], objectTypes: Record<string, string> = {}): TxReceipt {
  return { digest: '8Qdemo', events, objectIds: [], effects: { changedObjects }, objectTypes };
}

describe('typed transaction result decoding', () => {
  it('decodes the exact current event type and JSON field', () => {
    expect(decodeBountyCreatedId(receipt([{ eventType: `${PACKAGE}::databounty::BountyCreated`, json: { bountyId: BOUNTY } }]), PACKAGE)).toBe(BOUNTY);
    expect(decodeSubmissionReservedId(receipt([{ eventType: `${PACKAGE}::databounty::SubmissionReserved`, json: { submission_id: SUBMISSION } }]), PACKAGE)).toBe(SUBMISSION);
  });

  it('uses only one exact created object/type as the fallback', () => {
    expect(decodeBountyCreatedId(receipt([], [{ objectId: BOUNTY, idOperation: 'Created' }], { [BOUNTY]: `${PACKAGE}::databounty::Bounty` }), PACKAGE)).toBe(BOUNTY);
  });

  it('fails closed for missing or wrong event data', () => {
    expect(() => decodeBountyCreatedId(receipt(), PACKAGE)).toThrow(/did not include a valid/);
    expect(() => decodeBountyCreatedId(receipt([{ eventType: `0x${'bb'.repeat(32)}::databounty::BountyCreated`, json: { bounty_id: BOUNTY } }]), PACKAGE)).toThrow(/did not include a valid/);
    expect(() => decodeBountyCreatedId(receipt([{ eventType: `${PACKAGE}::other::BountyCreated`, json: { bounty_id: BOUNTY } }]), PACKAGE)).toThrow(/did not include a valid/);
  });

  it('fails closed for ambiguous exact events or typed objects', () => {
    const event = { eventType: `${PACKAGE}::databounty::BountyCreated`, json: { bounty_id: BOUNTY } };
    expect(() => decodeBountyCreatedId(receipt([event, event]), PACKAGE)).toThrow(/Ambiguous/);
    const second = `0x${'33'.repeat(32)}` as `0x${string}`;
    expect(() => decodeBountyCreatedId(receipt([], [{ objectId: BOUNTY, idOperation: 'Created' }, { objectId: second, idOperation: 'Created' }], { [BOUNTY]: `${PACKAGE}::databounty::Bounty`, [second]: `${PACKAGE}::databounty::Bounty` }), PACKAGE)).toThrow(/Ambiguous/);
  });
});
