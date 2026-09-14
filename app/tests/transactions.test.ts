import { describe, expect, it } from 'vitest';
import { approveSubmissionAndPayTx, createBountyTx, reserveSubmissionTx } from '../src/chain/transactions';

describe('DataBounty transaction builders', () => {
  it('fails closed when the explicit package is not configured', () => { expect(() => createBountyTx('spec', String(Date.now() + 60_000), '1')).toThrow(/VITE_DATABOUNTY_PACKAGE_ID/); });
  it('does not expose recipient or amount arguments for approve and pay', () => {
    expect(() => approveSubmissionAndPayTx(`0x${'11'.repeat(32)}`, `0x${'22'.repeat(32)}`)).toThrow(/VITE_DATABOUNTY_PACKAGE_ID/);
  });
  it('fails closed for reservation without a package', () => { expect(() => reserveSubmissionTx(`0x${'11'.repeat(32)}`, 'aa'.repeat(32))).toThrow(/VITE_DATABOUNTY_PACKAGE_ID/); });
});
