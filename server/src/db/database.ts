import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ErrorCode, ObjectId, ReviewStatus, SuiAddress, Sha256Hex } from '../api/types.js';

export interface ChallengeRow { id: string; address: SuiAddress; message: string; expiresAt: string; usedAt: string | null; }
export interface ReviewRow { runId: string; requestId: string; requester: SuiAddress; bountyId: ObjectId; submissionId: ObjectId; comparisonSubmissionIdsJson: string; status: ReviewStatus; errorCode: ErrorCode | null; provider: string | null; model: string | null; responseHash: Sha256Hex | null; createdAt: string; updatedAt: string; }

/** SQLite holds request and storage metadata only. Plaintext and completed review bodies are never persisted. */
export class DraftProofDb {
  readonly database: DatabaseSync;
  constructor(path: string) { if (!path.startsWith(':memory:')) mkdirSync(dirname(path), { recursive: true }); this.database = new DatabaseSync(path); this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;'); this.migrate(); }
  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, address TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS submission_uploads (submission_id TEXT PRIMARY KEY, bounty_id TEXT NOT NULL, contributor TEXT NOT NULL, blob_id TEXT, ciphertext_digest TEXT NOT NULL, storage_end_epoch TEXT, stage TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS review_runs (run_id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, requester TEXT NOT NULL, bounty_id TEXT NOT NULL, submission_id TEXT NOT NULL, comparison_submission_ids_json TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT, provider TEXT, model TEXT, response_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    `);
  }
  close(): void { this.database.close(); }
  transaction<T>(fn: () => T): T { this.database.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.database.exec('COMMIT'); return result; } catch (error) { this.database.exec('ROLLBACK'); throw error; } }
  createChallenge(id: string, address: SuiAddress, message: string, expiresAt: string): void { this.database.prepare('INSERT INTO auth_challenges (id,address,message,expires_at) VALUES (?,?,?,?)').run(id,address,message,expiresAt); }
  consumeChallenge(id: string): ChallengeRow | undefined { return this.transaction(() => { const row = this.database.prepare('SELECT id,address,message,expires_at AS expiresAt,used_at AS usedAt FROM auth_challenges WHERE id=?').get(id) as ChallengeRow | undefined; if (!row || row.usedAt || Date.parse(row.expiresAt) <= Date.now()) return undefined; this.database.prepare('UPDATE auth_challenges SET used_at=? WHERE id=? AND used_at IS NULL').run(new Date().toISOString(), id); return row; }); }
  createSession(tokenHash: string, address: SuiAddress, expiresAt: string): void { this.database.prepare('INSERT INTO sessions (token_hash,address,expires_at,created_at) VALUES (?,?,?,?)').run(tokenHash,address,expiresAt,new Date().toISOString()); }
  sessionAddress(tokenHash: string): SuiAddress | undefined { const row = this.database.prepare('SELECT address,expires_at AS expiresAt FROM sessions WHERE token_hash=?').get(tokenHash) as {address:SuiAddress;expiresAt:string}|undefined; return row && Date.parse(row.expiresAt) > Date.now() ? row.address : undefined; }
  createReview(requestId: string, requester: SuiAddress, bountyId: ObjectId, submissionId: ObjectId, comparisonSubmissionIds: ObjectId[]): ReviewRow | undefined { const now = new Date().toISOString(); const runId = randomUUID(); try { this.database.prepare('INSERT INTO review_runs (run_id,request_id,requester,bounty_id,submission_id,comparison_submission_ids_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?)').run(runId,requestId,requester,bountyId,submissionId,JSON.stringify(comparisonSubmissionIds),'RUNNING',now,now); return { runId, requestId, requester, bountyId, submissionId, comparisonSubmissionIdsJson: JSON.stringify(comparisonSubmissionIds), status: 'RUNNING', errorCode: null, provider: null, model: null, responseHash: null, createdAt: now, updatedAt: now }; } catch { return undefined; } }
  updateReview(runId: string, status: ReviewStatus, errorCode: ErrorCode | null, provider?: string, model?: string, responseHash?: Sha256Hex): void { this.database.prepare('UPDATE review_runs SET status=?,error_code=?,provider=COALESCE(?,provider),model=COALESCE(?,model),response_hash=COALESCE(?,response_hash),updated_at=? WHERE run_id=?').run(status,errorCode,provider ?? null,model ?? null,responseHash ?? null,new Date().toISOString(),runId); }
  getReview(runId: string): ReviewRow | undefined { return this.database.prepare('SELECT run_id AS runId,request_id AS requestId,requester,bounty_id AS bountyId,submission_id AS submissionId,comparison_submission_ids_json AS comparisonSubmissionIdsJson,status,error_code AS errorCode,provider,model,response_hash AS responseHash,created_at AS createdAt,updated_at AS updatedAt FROM review_runs WHERE run_id=?').get(runId) as ReviewRow|undefined; }
  getReviewByRequest(requestId: string): ReviewRow | undefined { return this.database.prepare('SELECT run_id AS runId,request_id AS requestId,requester,bounty_id AS bountyId,submission_id AS submissionId,comparison_submission_ids_json AS comparisonSubmissionIdsJson,status,error_code AS errorCode,provider,model,response_hash AS responseHash,created_at AS createdAt,updated_at AS updatedAt FROM review_runs WHERE request_id=?').get(requestId) as ReviewRow|undefined; }
  recordUpload(submissionId: ObjectId, bountyId: ObjectId, contributor: SuiAddress, digest: string, blobId: string, endEpoch: string): void { this.database.prepare('INSERT INTO submission_uploads(submission_id,bounty_id,contributor,blob_id,ciphertext_digest,storage_end_epoch,stage,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET blob_id=excluded.blob_id,storage_end_epoch=excluded.storage_end_epoch,stage=excluded.stage,updated_at=excluded.updated_at').run(submissionId,bountyId,contributor,blobId,digest,endEpoch,'VERIFIED',new Date().toISOString()); }
}
