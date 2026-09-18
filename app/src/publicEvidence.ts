export type PublicEvidenceStatus = 'verified' | 'recorded';

export interface PublicEvidenceItem {
  id: string;
  date: string;
  label: string;
  detail: string;
  identifier: string;
  status: PublicEvidenceStatus;
}

/** Public-safe Testnet evidence. Never add plaintext, secrets, signatures, or private keys. */
export const publicEvidence: PublicEvidenceItem[] = [
  { id: 'package', date: '2026-09-14', label: 'DataBounty package published', detail: 'Sui Testnet package for escrow, submission lifecycle, and Seal policy checks.', identifier: '0xf7923bd3…a89b0aa', status: 'verified' },
  { id: 'reserve', date: '2026-09-18', label: 'Encrypted submission reserved', detail: 'Requester/contributor wallet created a live Submission commitment on Sui Testnet.', identifier: 'HWsY1oy9…Mkt7T', status: 'verified' },
  { id: 'finalize', date: '2026-09-18', label: 'Walrus metadata finalized on Sui', detail: 'SubmissionFinalized recorded blob metadata, SHA-256 digest, and storage end epoch 529.', identifier: '9uf4wZcj…WpWe', status: 'verified' },
  { id: 'walrus', date: '2026-09-18', label: 'Walrus ciphertext readback', detail: 'Aggregator returned 1,163 encrypted bytes. Readback SHA-256 exactly matched the Sui event digest.', identifier: 'EDoj9-ET…byq9c', status: 'verified' },
  { id: 'seal', date: '2026-09-18', label: 'Seal identity binding', detail: 'Downloaded Walrus ciphertext parsed as a Seal object bound to the exact Bounty and Submission IDs.', identifier: '0x040467…31af6', status: 'verified' },
  { id: 'grant', date: '2026-09-18', label: 'Exact reviewer read grant', detail: 'Requester signed a time-limited Sui reviewer grant for the selected submission.', identifier: 'HcAvLYUU…zrtt', status: 'verified' },
  { id: 'ai-review', date: '2026-09-18', label: 'Grounded Groq review', detail: 'Groq openai/gpt-oss-20b returned RECOMMEND_ACCEPT; required fields were checked against exact UTF-8 source bytes.', identifier: 'bytes 0–747', status: 'verified' },
  { id: 'payout', date: '2026-09-18', label: 'Requester-signed Testnet payout', detail: 'SubmissionApproved transferred the Testnet escrow once; Bounty is PAID and Submission is ACCEPTED.', identifier: '9aDuBYce…YcaR', status: 'verified' },
  { id: 'seal-denial', date: '2026-09-18', label: 'Fresh Seal denial after payout', detail: 'A new reviewer Seal session for the same Walrus ciphertext was denied after terminal settlement.', identifier: 'key request denied', status: 'verified' },
  { id: 'refund', date: '2026-09-18', label: 'Expired Bounty refund', detail: 'Requester signed a Testnet deadline refund; the separate empty Bounty is EXPIRED_REFUNDED with zero escrow.', identifier: 'ANznJg8A…KkMM', status: 'verified' },
];

export const pendingEvidence = [
  'Second full happy-path run or verified backup recording',
];
