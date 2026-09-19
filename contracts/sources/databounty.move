#[allow(lint(public_entry))]
module databounty::databounty {
    use std::option::{Self, Option};
    use std::vector;
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const STATE_OPEN: u8 = 0;
    const STATE_REVIEWING: u8 = 1;
    const STATE_PAID: u8 = 2;
    const STATE_EXPIRED_REFUNDED: u8 = 3;

    const SUBMISSION_RESERVED: u8 = 0;
    const SUBMISSION_READY: u8 = 1;
    const SUBMISSION_REJECTED: u8 = 2;
    const SUBMISSION_ACCEPTED: u8 = 3;
    const SUBMISSION_ABANDONED: u8 = 4;

    // Small, explicit limits keep shared-object vectors bounded for the MVP.
    const MAX_PUBLIC_TASK_SPEC_BYTES: u64 = 16_384;
    const MAX_SUBMISSIONS: u64 = 20;
    const MAX_REVIEWER_GRANTS: u64 = 8;
    const ID_BYTES: u64 = 32;
    const SEAL_IDENTITY_BYTES: u64 = 64;

    const E_NOT_REQUESTER: u64 = 0;
    const E_NOT_CONTRIBUTOR: u64 = 1;
    const E_INVALID_STATE: u64 = 2;
    const E_INVALID_BINDING: u64 = 3;
    const E_INVALID_DEADLINE: u64 = 4;
    const E_INVALID_SPEC: u64 = 5;
    const E_INVALID_REWARD: u64 = 6;
    const E_INVALID_COMMITMENT: u64 = 7;
    const E_SUBMISSION_LIMIT: u64 = 8;
    const E_INVALID_BLOB: u64 = 9;
    const E_INVALID_DIGEST: u64 = 10;
    const E_INVALID_EXPIRY: u64 = 11;
    const E_GRANT_LIMIT: u64 = 12;
    const E_GRANT_NOT_FOUND: u64 = 13;
    const E_ACCESS_DENIED: u64 = 14;
    const E_INVALID_SEAL_IDENTITY: u64 = 15;
    const E_READY_SUBMISSIONS: u64 = 16;

    public struct ReviewerGrant has store, drop {
        reviewer: address,
        expires_at_ms: u64,
        revoked: bool,
        grant_revision: u64,
    }

    public struct Bounty has key {
        id: UID,
        requester: address,
        reward: Balance<SUI>,
        public_task_spec: vector<u8>,
        deadline_ms: u64,
        state: u8,
        submission_ids: vector<ID>,
        ready_submission_count: u64,
        accepted_submission_id: Option<ID>,
        policy_revision: u64,
    }

    public struct Submission has key {
        id: UID,
        bounty_id: ID,
        contributor: address,
        content_commitment: vector<u8>,
        state: u8,
        blob_id: Option<vector<u8>>,
        ciphertext_digest: Option<vector<u8>>,
        storage_end_epoch: Option<u64>,
        reserved_at_ms: u64,
        finalized_at_ms: Option<u64>,
        reviewer_grants: vector<ReviewerGrant>,
    }

    public struct BountyCreated has copy, drop {
        bounty_id: ID,
        requester: address,
        deadline_ms: u64,
        reward_mist: u64,
    }

    public struct SubmissionReserved has copy, drop {
        bounty_id: ID,
        submission_id: ID,
        contributor: address,
        content_commitment: vector<u8>,
        reserved_at_ms: u64,
    }

    public struct SubmissionFinalized has copy, drop {
        bounty_id: ID,
        submission_id: ID,
        blob_id: vector<u8>,
        ciphertext_digest: vector<u8>,
        storage_end_epoch: u64,
        finalized_at_ms: u64,
    }

    public struct SubmissionAbandoned has copy, drop {
        bounty_id: ID,
        submission_id: ID,
        abandoned_at_ms: u64,
    }

    public struct ReviewerReadGranted has copy, drop {
        bounty_id: ID,
        submission_id: ID,
        reviewer: address,
        expires_at_ms: u64,
        grant_revision: u64,
        policy_revision: u64,
    }

    public struct ReviewerReadRevoked has copy, drop {
        bounty_id: ID,
        submission_id: ID,
        reviewer: address,
        grant_revision: u64,
        policy_revision: u64,
        revoked_at_ms: u64,
    }

    public struct SubmissionRejected has copy, drop {
        bounty_id: ID,
        submission_id: ID,
        rejected_at_ms: u64,
    }

    public struct SubmissionApproved has copy, drop {
        bounty_id: ID,
        submission_id: ID,
        contributor: address,
        approved_at_ms: u64,
    }

    public struct BountyCancelled has copy, drop {
        bounty_id: ID,
        requester: address,
        cancelled_at_ms: u64,
    }

    public struct BountyRefunded has copy, drop {
        bounty_id: ID,
        requester: address,
        refunded_at_ms: u64,
    }

    public entry fun create_bounty(
        public_task_spec: vector<u8>,
        deadline_ms: u64,
        reward: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        assert!(vector::length(&public_task_spec) > 0 && vector::length(&public_task_spec) <= MAX_PUBLIC_TASK_SPEC_BYTES, E_INVALID_SPEC);
        assert!(deadline_ms > now, E_INVALID_DEADLINE);
        let reward_mist = coin::value(&reward);
        assert!(reward_mist > 0, E_INVALID_REWARD);
        let bounty = Bounty {
            id: object::new(ctx),
            requester: tx_context::sender(ctx),
            reward: coin::into_balance(reward),
            public_task_spec,
            deadline_ms,
            state: STATE_OPEN,
            submission_ids: vector[],
            ready_submission_count: 0,
            accepted_submission_id: option::none(),
            policy_revision: 0,
        };
        let bounty_id = bounty.id.to_inner();
        event::emit(BountyCreated {
            bounty_id,
            requester: bounty.requester,
            deadline_ms,
            reward_mist,
        });
        transfer::share_object(bounty);
    }

    public entry fun reserve_submission(
        bounty: &mut Bounty,
        content_commitment: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        assert!(bounty.state == STATE_OPEN || bounty.state == STATE_REVIEWING, E_INVALID_STATE);
        assert!(now < bounty.deadline_ms, E_INVALID_DEADLINE);
        assert!(vector::length(&content_commitment) == ID_BYTES, E_INVALID_COMMITMENT);
        assert!(vector::length(&bounty.submission_ids) < MAX_SUBMISSIONS, E_SUBMISSION_LIMIT);
        let submission = Submission {
            id: object::new(ctx),
            bounty_id: bounty.id.to_inner(),
            contributor: tx_context::sender(ctx),
            content_commitment,
            state: SUBMISSION_RESERVED,
            blob_id: option::none(),
            ciphertext_digest: option::none(),
            storage_end_epoch: option::none(),
            reserved_at_ms: now,
            finalized_at_ms: option::none(),
            reviewer_grants: vector[],
        };
        let submission_id = submission.id.to_inner();
        vector::push_back(&mut bounty.submission_ids, submission_id);
        event::emit(SubmissionReserved {
            bounty_id: bounty.id.to_inner(),
            submission_id,
            contributor: tx_context::sender(ctx),
            content_commitment: copy submission.content_commitment,
            reserved_at_ms: now,
        });
        transfer::share_object(submission);
    }

    public entry fun finalize_submission(
        bounty: &mut Bounty,
        submission: &mut Submission,
        blob_id: vector<u8>,
        ciphertext_digest: vector<u8>,
        storage_end_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_submission_parent(bounty, submission);
        assert!(submission.contributor == tx_context::sender(ctx), E_NOT_CONTRIBUTOR);
        assert!(submission.state == SUBMISSION_RESERVED, E_INVALID_STATE);
        assert!(!is_terminal(bounty.state), E_INVALID_STATE);
        assert!(clock::timestamp_ms(clock) < bounty.deadline_ms, E_INVALID_DEADLINE);
        assert!(!vector::is_empty(&blob_id), E_INVALID_BLOB);
        assert!(vector::length(&ciphertext_digest) == ID_BYTES, E_INVALID_DIGEST);
        submission.blob_id = option::some(copy blob_id);
        submission.ciphertext_digest = option::some(copy ciphertext_digest);
        submission.storage_end_epoch = option::some(storage_end_epoch);
        submission.finalized_at_ms = option::some(clock::timestamp_ms(clock));
        submission.state = SUBMISSION_READY;
        bounty.ready_submission_count = bounty.ready_submission_count + 1;
        bounty.state = STATE_REVIEWING;
        event::emit(SubmissionFinalized {
            bounty_id: bounty.id.to_inner(),
            submission_id: submission.id.to_inner(),
            blob_id,
            ciphertext_digest,
            storage_end_epoch,
            finalized_at_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun abandon_submission(
        bounty: &Bounty,
        submission: &mut Submission,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_submission_parent(bounty, submission);
        assert!(submission.contributor == tx_context::sender(ctx), E_NOT_CONTRIBUTOR);
        assert!(submission.state == SUBMISSION_RESERVED, E_INVALID_STATE);
        assert!(!is_terminal(bounty.state), E_INVALID_STATE);
        submission.state = SUBMISSION_ABANDONED;
        event::emit(SubmissionAbandoned {
            bounty_id: bounty.id.to_inner(),
            submission_id: submission.id.to_inner(),
            abandoned_at_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun grant_reviewer_read(
        bounty: &mut Bounty,
        submission: &mut Submission,
        reviewer: address,
        expires_at_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_requester(bounty, ctx);
        assert_submission_parent(bounty, submission);
        assert!(submission.state == SUBMISSION_READY || submission.state == SUBMISSION_ACCEPTED, E_INVALID_STATE);
        assert!(expires_at_ms > clock::timestamp_ms(clock), E_INVALID_EXPIRY);
        let grant_revision = upsert_grant(&mut submission.reviewer_grants, reviewer, expires_at_ms);
        bounty.policy_revision = bounty.policy_revision + 1;
        let policy_revision = bounty.policy_revision;
        event::emit(ReviewerReadGranted {
            bounty_id: bounty.id.to_inner(),
            submission_id: submission.id.to_inner(),
            reviewer,
            expires_at_ms,
            grant_revision,
            policy_revision,
        });
    }

    public entry fun revoke_reviewer_read(
        bounty: &mut Bounty,
        submission: &mut Submission,
        reviewer: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_requester(bounty, ctx);
        assert_submission_parent(bounty, submission);
        assert!(submission.state == SUBMISSION_READY || submission.state == SUBMISSION_ACCEPTED, E_INVALID_STATE);
        let grant_revision = revoke_grant(&mut submission.reviewer_grants, reviewer);
        bounty.policy_revision = bounty.policy_revision + 1;
        event::emit(ReviewerReadRevoked {
            bounty_id: bounty.id.to_inner(),
            submission_id: submission.id.to_inner(),
            reviewer,
            grant_revision,
            policy_revision: bounty.policy_revision,
            revoked_at_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun reject_submission(
        bounty: &mut Bounty,
        submission: &mut Submission,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_requester(bounty, ctx);
        assert_submission_parent(bounty, submission);
        assert!(submission.state == SUBMISSION_READY, E_INVALID_STATE);
        assert!(!is_terminal(bounty.state), E_INVALID_STATE);
        submission.state = SUBMISSION_REJECTED;
        bounty.ready_submission_count = bounty.ready_submission_count - 1;
        if (bounty.ready_submission_count == 0) bounty.state = STATE_OPEN;
        revoke_all_grants(submission);
        bounty.policy_revision = bounty.policy_revision + 1;
        event::emit(SubmissionRejected {
            bounty_id: bounty.id.to_inner(),
            submission_id: submission.id.to_inner(),
            rejected_at_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun approve_submission_and_pay(
        bounty: &mut Bounty,
        submission: &mut Submission,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_requester(bounty, ctx);
        assert_submission_parent(bounty, submission);
        assert!(submission.state == SUBMISSION_READY, E_INVALID_STATE);
        assert!(bounty.state == STATE_REVIEWING, E_INVALID_STATE);
        assert!(clock::timestamp_ms(clock) < bounty.deadline_ms, E_INVALID_DEADLINE);
        let contributor = submission.contributor;
        let submission_id = submission.id.to_inner();
        submission.state = SUBMISSION_ACCEPTED;
        bounty.accepted_submission_id = option::some(submission_id);
        bounty.ready_submission_count = bounty.ready_submission_count - 1;
        bounty.state = STATE_PAID;
        revoke_all_grants(submission);
        bounty.policy_revision = bounty.policy_revision + 1;
        let payout = coin::from_balance(balance::withdraw_all(&mut bounty.reward), ctx);
        transfer::public_transfer(payout, contributor);
        event::emit(SubmissionApproved {
            bounty_id: bounty.id.to_inner(),
            submission_id,
            contributor,
            approved_at_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun cancel_open_bounty(
        bounty: &mut Bounty,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_requester(bounty, ctx);
        assert!(!is_terminal(bounty.state), E_INVALID_STATE);
        assert!(clock::timestamp_ms(clock) < bounty.deadline_ms, E_INVALID_DEADLINE);
        assert!(bounty.ready_submission_count == 0, E_READY_SUBMISSIONS);
        let refund = coin::from_balance(balance::withdraw_all(&mut bounty.reward), ctx);
        bounty.state = STATE_EXPIRED_REFUNDED;
        transfer::public_transfer(refund, bounty.requester);
        event::emit(BountyCancelled {
            bounty_id: bounty.id.to_inner(),
            requester: bounty.requester,
            cancelled_at_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun refund_expired_bounty(
        bounty: &mut Bounty,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_requester(bounty, ctx);
        assert!(!is_terminal(bounty.state), E_INVALID_STATE);
        assert!(clock::timestamp_ms(clock) >= bounty.deadline_ms, E_INVALID_DEADLINE);
        let refund = coin::from_balance(balance::withdraw_all(&mut bounty.reward), ctx);
        bounty.state = STATE_EXPIRED_REFUNDED;
        transfer::public_transfer(refund, bounty.requester);
        event::emit(BountyRefunded {
            bounty_id: bounty.id.to_inner(),
            requester: bounty.requester,
            refunded_at_ms: clock::timestamp_ms(clock),
        });
    }

    entry fun seal_approve(
        identity: vector<u8>,
        bounty: &Bounty,
        submission: &Submission,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(vector::length(&identity) == SEAL_IDENTITY_BYTES, E_INVALID_SEAL_IDENTITY);
        assert_submission_parent(bounty, submission);
        assert!(identity == expected_seal_identity(bounty, submission), E_INVALID_SEAL_IDENTITY);
        assert!(bounty.state != STATE_EXPIRED_REFUNDED, E_INVALID_STATE);
        assert!(submission.state == SUBMISSION_READY || submission.state == SUBMISSION_ACCEPTED, E_INVALID_STATE);
        let reader = tx_context::sender(ctx);
        assert!(reader == bounty.requester || reader == submission.contributor || has_active_grant(submission, reader, clock::timestamp_ms(clock)), E_ACCESS_DENIED);
    }

    public fun bounty_owner(bounty: &Bounty): address { bounty.requester }
    public fun bounty_state(bounty: &Bounty): u8 { bounty.state }
    public fun bounty_deadline_ms(bounty: &Bounty): u64 { bounty.deadline_ms }
    public fun bounty_reward_value(bounty: &Bounty): u64 { balance::value(&bounty.reward) }
    public fun bounty_public_task_spec(bounty: &Bounty): vector<u8> { copy bounty.public_task_spec }
    public fun bounty_ready_submission_count(bounty: &Bounty): u64 { bounty.ready_submission_count }
    public fun bounty_accepted_submission_id(bounty: &Bounty): Option<ID> { copy bounty.accepted_submission_id }
    public fun bounty_submission_count(bounty: &Bounty): u64 { vector::length(&bounty.submission_ids) }
    public fun bounty_policy_revision(bounty: &Bounty): u64 { bounty.policy_revision }
    public fun submission_bounty_id(submission: &Submission): ID { submission.bounty_id }
    public fun submission_contributor(submission: &Submission): address { submission.contributor }
    public fun submission_state(submission: &Submission): u8 { submission.state }
    public fun submission_content_commitment(submission: &Submission): vector<u8> { copy submission.content_commitment }
    public fun submission_blob_id(submission: &Submission): Option<vector<u8>> { copy submission.blob_id }
    public fun submission_ciphertext_digest(submission: &Submission): Option<vector<u8>> { copy submission.ciphertext_digest }
    public fun submission_storage_end_epoch(submission: &Submission): Option<u64> { copy submission.storage_end_epoch }
    public fun submission_reserved_at_ms(submission: &Submission): u64 { submission.reserved_at_ms }
    public fun submission_finalized_at_ms(submission: &Submission): Option<u64> { copy submission.finalized_at_ms }
    public fun submission_reviewer_count(submission: &Submission): u64 { vector::length(&submission.reviewer_grants) }
    public fun expected_seal_identity(bounty: &Bounty, submission: &Submission): vector<u8> {
        let mut identity = object::uid_to_bytes(&bounty.id);
        vector::append(&mut identity, object::uid_to_bytes(&submission.id));
        identity
    }
    public fun can_read(bounty: &Bounty, submission: &Submission, reader: address, clock: &Clock): bool {
        is_valid_submission_binding(bounty, submission)
            && (submission.state == SUBMISSION_READY || submission.state == SUBMISSION_ACCEPTED)
            && (reader == bounty.requester || reader == submission.contributor || has_active_grant(submission, reader, clock::timestamp_ms(clock)))
    }
    public fun max_public_task_spec_bytes(): u64 { MAX_PUBLIC_TASK_SPEC_BYTES }
    public fun max_submissions(): u64 { MAX_SUBMISSIONS }
    public fun max_reviewer_grants(): u64 { MAX_REVIEWER_GRANTS }

    fun assert_requester(bounty: &Bounty, ctx: &TxContext) {
        assert!(bounty.requester == tx_context::sender(ctx), E_NOT_REQUESTER);
    }

    fun assert_submission_parent(bounty: &Bounty, submission: &Submission) {
        assert!(is_valid_submission_binding(bounty, submission), E_INVALID_BINDING);
    }

    fun is_valid_submission_binding(bounty: &Bounty, submission: &Submission): bool {
        bounty.id.to_inner() == submission.bounty_id && bounty_contains_submission(bounty, submission.id.to_inner())
    }

    fun bounty_contains_submission(bounty: &Bounty, submission_id: ID): bool {
        let mut i = 0;
        while (i < vector::length(&bounty.submission_ids)) {
            if (*vector::borrow(&bounty.submission_ids, i) == submission_id) return true;
            i = i + 1;
        };
        false
    }

    fun is_terminal(state: u8): bool { state == STATE_PAID || state == STATE_EXPIRED_REFUNDED }

    fun upsert_grant(grants: &mut vector<ReviewerGrant>, reviewer: address, expires_at_ms: u64): u64 {
        let mut i = 0;
        while (i < vector::length(grants)) {
            let grant = vector::borrow_mut(grants, i);
            if (grant.reviewer == reviewer) {
                grant.expires_at_ms = expires_at_ms;
                grant.revoked = false;
                grant.grant_revision = grant.grant_revision + 1;
                return grant.grant_revision
            };
            i = i + 1;
        };
        assert!(vector::length(grants) < MAX_REVIEWER_GRANTS, E_GRANT_LIMIT);
        vector::push_back(grants, ReviewerGrant {
            reviewer,
            expires_at_ms,
            revoked: false,
            grant_revision: 1,
        });
        1
    }

    fun revoke_grant(grants: &mut vector<ReviewerGrant>, reviewer: address): u64 {
        let mut i = 0;
        while (i < vector::length(grants)) {
            let grant = vector::borrow_mut(grants, i);
            if (grant.reviewer == reviewer) {
                assert!(!grant.revoked, E_GRANT_NOT_FOUND);
                grant.revoked = true;
                grant.grant_revision = grant.grant_revision + 1;
                return grant.grant_revision
            };
            i = i + 1;
        };
        abort E_GRANT_NOT_FOUND
    }

    fun revoke_all_grants(submission: &mut Submission) {
        let mut i = 0;
        while (i < vector::length(&submission.reviewer_grants)) {
            let grant = vector::borrow_mut(&mut submission.reviewer_grants, i);
            if (!grant.revoked) {
                grant.revoked = true;
                grant.grant_revision = grant.grant_revision + 1;
            };
            i = i + 1;
        };
    }

    fun has_active_grant(submission: &Submission, reviewer: address, now_ms: u64): bool {
        let mut i = 0;
        while (i < vector::length(&submission.reviewer_grants)) {
            let grant = vector::borrow(&submission.reviewer_grants, i);
            if (grant.reviewer == reviewer) return !grant.revoked && now_ms < grant.expires_at_ms;
            i = i + 1;
        };
        false
    }

    #[test_only]
    public fun test_identity_length(): u64 {
        let mut ctx = tx_context::new_from_hint(@0xA, 1, 0, 0, 0);
        let (bounty, submission) = test_pair(@0xA, @0xB, &mut ctx);
        let length = vector::length(&expected_seal_identity(&bounty, &submission));
        destroy_pair(bounty, submission);
        length
    }

    #[test_only]
    public fun test_commitment_and_digest_bounds(): bool {
        let mut ctx = tx_context::new_from_hint(@0xB, 2, 0, 0, 0);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        let clock = clock::create_for_testing(&mut ctx);
        submission.state = SUBMISSION_RESERVED;
        finalize_submission(&mut bounty, &mut submission, vector[1], x"0000000000000000000000000000000000000000000000000000000000000000", 1, &clock, &mut ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
        true
    }

    #[test_only]
    public fun test_grant_expiry_and_revoke(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 3, 0, 0, 0);
        let mut clock = clock::create_for_testing(&mut ctx);
        let (bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        submission.state = SUBMISSION_READY;
        upsert_grant(&mut submission.reviewer_grants, @0xC, 10);
        assert!(can_read(&bounty, &submission, @0xC, &clock), 1);
        clock::set_for_testing(&mut clock, 10);
        assert!(!can_read(&bounty, &submission, @0xC, &clock), 2);
        submission.state = SUBMISSION_ACCEPTED;
        revoke_all_grants(&mut submission);
        assert!(!can_read(&bounty, &submission, @0xC, &clock), 3);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
        true
    }

    #[test_only]
    public fun test_reviewer_policy_revision_increments_per_success(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 15, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);

        assert!(bounty_policy_revision(&bounty) == 0, 13);
        grant_reviewer_read(&mut bounty, &mut submission, @0xC, 10, &clock, &mut ctx);
        assert!(bounty_policy_revision(&bounty) == 1, 14);
        grant_reviewer_read(&mut bounty, &mut submission, @0xC, 20, &clock, &mut ctx);
        assert!(bounty_policy_revision(&bounty) == 2, 15);
        revoke_reviewer_read(&mut bounty, &mut submission, @0xC, &clock, &mut ctx);
        assert!(bounty_policy_revision(&bounty) == 3, 16);

        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
        true
    }

    #[test_only]
    public fun test_unauthorized_grant_aborts_without_revision_change() {
        let mut owner_ctx = tx_context::new_from_hint(@0xA, 16, 0, 0, 0);
        let mut attacker_ctx = tx_context::new_from_hint(@0xD, 17, 0, 0, 0);
        let clock = clock::create_for_testing(&mut owner_ctx);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut owner_ctx);
        grant_reviewer_read(&mut bounty, &mut submission, @0xC, 10, &clock, &mut attacker_ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_failed_revoke_aborts_without_revision_change() {
        let mut ctx = tx_context::new_from_hint(@0xA, 18, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        revoke_reviewer_read(&mut bounty, &mut submission, @0xC, &clock, &mut ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_binding_rejects_parent_substitution(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 4, 0, 0, 0);
        let (bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        let (other_bounty, other_submission) = test_pair(@0xA, @0xC, &mut ctx);
        submission.bounty_id = other_bounty.id.to_inner();
        assert!(!is_valid_submission_binding(&bounty, &submission), 4);
        destroy_pair(bounty, submission);
        destroy_pair(other_bounty, other_submission);
        true
    }

    #[test_only]
    public fun test_reject_returns_open_and_clears_ready(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 5, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        submission.state = SUBMISSION_READY;
        bounty.ready_submission_count = 1;
        bounty.state = STATE_REVIEWING;
        reject_submission(&mut bounty, &mut submission, &clock, &mut ctx);
        assert!(bounty.state == STATE_OPEN, 5);
        assert!(bounty.ready_submission_count == 0, 6);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
        true
    }

    #[test_only]
    public fun test_expiry_boundary_is_inclusive(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 6, 0, 0, 0);
        let mut clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, submission) = test_pair(@0xA, @0xB, &mut ctx);
        bounty.deadline_ms = 10;
        clock::set_for_testing(&mut clock, 10);
        assert!(clock::timestamp_ms(&clock) >= bounty.deadline_ms, 7);
        assert!(submission.bounty_id == bounty.id.to_inner(), 8);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
        true
    }

    #[test_only]
    public fun test_refund_at_deadline_consumes_escrow(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 14, 0, 0, 0);
        let mut clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, submission) = test_pair(@0xA, @0xB, &mut ctx);
        bounty.deadline_ms = 10;
        clock::set_for_testing(&mut clock, 10);
        refund_expired_bounty(&mut bounty, &clock, &mut ctx);
        assert!(bounty.state == STATE_EXPIRED_REFUNDED, 11);
        assert!(balance::value(&bounty.reward) == 0, 12);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
        true
    }

    #[test_only]
    public fun test_terminal_state_blocks_second_payout(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 7, 0, 0, 0);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        bounty.state = STATE_PAID;
        submission.state = SUBMISSION_ACCEPTED;
        assert!(is_terminal(bounty.state), 9);
        assert!(submission.state == SUBMISSION_ACCEPTED, 10);
        destroy_pair(bounty, submission);
        true
    }

    #[test_only]
    public fun test_unauthorized_approve_aborts() {
        let mut ctx = tx_context::new_from_hint(@0xB, 8, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        approve_submission_and_pay(&mut bounty, &mut submission, &clock, &mut ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_double_approve_aborts() {
        let mut ctx = tx_context::new_from_hint(@0xA, 9, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        approve_submission_and_pay(&mut bounty, &mut submission, &clock, &mut ctx);
        approve_submission_and_pay(&mut bounty, &mut submission, &clock, &mut ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_ready_cancel_aborts() {
        let mut ctx = tx_context::new_from_hint(@0xA, 10, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, submission) = test_pair(@0xA, @0xB, &mut ctx);
        bounty.ready_submission_count = 1;
        cancel_open_bounty(&mut bounty, &clock, &mut ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_terminal_bounty_cannot_finalize() {
        let mut ctx = tx_context::new_from_hint(@0xB, 13, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut bounty, mut submission) = test_pair(@0xA, @0xB, &mut ctx);
        bounty.state = STATE_EXPIRED_REFUNDED;
        submission.state = SUBMISSION_RESERVED;
        finalize_submission(&mut bounty, &mut submission, vector[1], x"0000000000000000000000000000000000000000000000000000000000000000", 1, &clock, &mut ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_seal_unauthorized_aborts() {
        let mut owner_ctx = tx_context::new_from_hint(@0xA, 11, 0, 0, 0);
        let reader_ctx = tx_context::new_from_hint(@0xD, 12, 0, 0, 0);
        let clock = clock::create_for_testing(&mut owner_ctx);
        let (bounty, submission) = test_pair(@0xA, @0xB, &mut owner_ctx);
        let identity = expected_seal_identity(&bounty, &submission);
        seal_approve(identity, &bounty, &submission, &clock, &reader_ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_refunded_bounty_blocks_fresh_seal_access() {
        let mut owner_ctx = tx_context::new_from_hint(@0xA, 15, 0, 0, 0);
        let reader_ctx = tx_context::new_from_hint(@0xA, 16, 0, 0, 0);
        let mut clock = clock::create_for_testing(&mut owner_ctx);
        let (mut bounty, submission) = test_pair(@0xA, @0xB, &mut owner_ctx);
        bounty.deadline_ms = 10;
        clock::set_for_testing(&mut clock, 10);
        refund_expired_bounty(&mut bounty, &clock, &mut owner_ctx);
        let identity = expected_seal_identity(&bounty, &submission);
        seal_approve(identity, &bounty, &submission, &clock, &reader_ctx);
        destroy_pair(bounty, submission);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    fun test_pair(requester: address, contributor: address, ctx: &mut TxContext): (Bounty, Submission) {
        let mut bounty = Bounty {
            id: object::new(ctx),
            requester,
            reward: balance::create_for_testing(100),
            public_task_spec: b"spec",
            deadline_ms: 100,
            state: STATE_REVIEWING,
            submission_ids: vector[],
            ready_submission_count: 0,
            accepted_submission_id: option::none(),
            policy_revision: 0,
        };
        let submission = Submission {
            id: object::new(ctx),
            bounty_id: bounty.id.to_inner(),
            contributor,
            content_commitment: x"0000000000000000000000000000000000000000000000000000000000000000",
            state: SUBMISSION_READY,
            blob_id: option::some(vector[1]),
            ciphertext_digest: option::some(x"0000000000000000000000000000000000000000000000000000000000000000"),
            storage_end_epoch: option::some(1),
            reserved_at_ms: 0,
            finalized_at_ms: option::some(1),
            reviewer_grants: vector[],
        };
        vector::push_back(&mut bounty.submission_ids, submission.id.to_inner());
        (bounty, submission)
    }

    #[test_only]
    fun destroy_pair(bounty: Bounty, submission: Submission) {
        let Bounty {
            id,
            requester: _,
            reward,
            public_task_spec: _,
            deadline_ms: _,
            state: _,
            submission_ids: _,
            ready_submission_count: _,
            accepted_submission_id: _,
            policy_revision: _,
        } = bounty;
        balance::destroy_for_testing(reward);
        id.delete();
        let Submission {
            id: submission_id,
            bounty_id: _,
            contributor: _,
            content_commitment: _,
            state: _,
            blob_id: _,
            ciphertext_digest: _,
            storage_end_epoch: _,
            reserved_at_ms: _,
            finalized_at_ms: _,
            reviewer_grants: _,
        } = submission;
        submission_id.delete();
    }
}
