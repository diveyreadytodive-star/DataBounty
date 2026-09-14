#[allow(lint(public_entry))]
module draftproof::draftproof {
    use std::option::{Self, Option};
    use std::vector;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const SCHEMA_VERSION: u64 = 1;
    const STATE_RESERVED: u8 = 0;
    const STATE_READY: u8 = 1;
    const STATE_ABANDONED: u8 = 2;
    const ORIGIN_USER: u8 = 0;
    const ORIGIN_AI: u8 = 1;

    const MAX_VERSIONS: u64 = 20;
    const MAX_GRANTS: u64 = 100;
    const MAX_INPUT_VERSIONS: u64 = 5;
    const ID_BYTES: u64 = 32;
    const SEAL_IDENTITY_BYTES: u64 = 64;

    const E_NOT_OWNER: u64 = 0;
    const E_INVALID_SCHEMA: u64 = 1;
    const E_INVALID_BINDING: u64 = 2;
    const E_VERSION_LIMIT: u64 = 3;
    const E_GRANT_LIMIT: u64 = 4;
    const E_INVALID_DOCUMENT_ID: u64 = 5;
    const E_INVALID_COMMITMENT: u64 = 6;
    const E_INVALID_ORIGIN: u64 = 7;
    const E_INVALID_INPUTS: u64 = 8;
    const E_PREVIOUS_NOT_READY: u64 = 9;
    const E_INVALID_STATE: u64 = 10;
    const E_INVALID_BLOB: u64 = 11;
    const E_INVALID_DIGEST: u64 = 12;
    const E_INVALID_EXPIRY: u64 = 13;
    const E_GRANT_NOT_FOUND: u64 = 14;
    const E_ACCESS_DENIED: u64 = 15;
    const E_INVALID_SEAL_IDENTITY: u64 = 16;

    public struct Grant has store, drop {
        version_id: ID,
        reader: address,
        expires_at_ms: u64,
        revoked: bool,
        grant_revision: u64,
    }

    public struct Workspace has key {
        id: UID,
        owner: address,
        schema_version: u64,
        policy_revision: u64,
        version_ids: vector<ID>,
        grants: vector<Grant>,
    }

    public struct Version has key {
        id: UID,
        workspace_id: ID,
        schema_version: u64,
        document_id: vector<u8>,
        previous_version_id: Option<ID>,
        creator: address,
        content_commitment: vector<u8>,
        state: u8,
        blob_id: Option<vector<u8>>,
        ciphertext_digest: Option<vector<u8>>,
        storage_end_epoch: Option<u64>,
        origin: u8,
        input_version_ids: vector<ID>,
        reserved_at_ms: u64,
        finalized_at_ms: Option<u64>,
    }

    public struct WorkspaceCreated has copy, drop {
        workspace_id: ID,
        owner: address,
        schema_version: u64,
    }

    public struct VersionReserved has copy, drop {
        workspace_id: ID,
        version_id: ID,
        schema_version: u64,
        document_id: vector<u8>,
        previous_version_id: Option<ID>,
        creator: address,
        content_commitment: vector<u8>,
        origin: u8,
        reserved_at_ms: u64,
    }

    public struct VersionFinalized has copy, drop {
        workspace_id: ID,
        version_id: ID,
        blob_id: vector<u8>,
        ciphertext_digest: vector<u8>,
        storage_end_epoch: u64,
        finalized_at_ms: u64,
    }

    public struct VersionAbandoned has copy, drop {
        workspace_id: ID,
        version_id: ID,
        abandoned_at_ms: u64,
    }

    public struct ReadGranted has copy, drop {
        workspace_id: ID,
        version_id: ID,
        reader: address,
        expires_at_ms: u64,
        grant_revision: u64,
        policy_revision: u64,
    }

    public struct ReadRevoked has copy, drop {
        workspace_id: ID,
        version_id: ID,
        reader: address,
        grant_revision: u64,
        policy_revision: u64,
        revoked_at_ms: u64,
    }

    public entry fun create_workspace(ctx: &mut TxContext) {
        let workspace = Workspace {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            schema_version: SCHEMA_VERSION,
            policy_revision: 0,
            version_ids: vector[],
            grants: vector[],
        };
        event::emit(WorkspaceCreated {
            workspace_id: workspace.id.to_inner(),
            owner: workspace.owner,
            schema_version: SCHEMA_VERSION,
        });
        transfer::share_object(workspace);
    }

    public entry fun reserve_initial_version(
        workspace: &mut Workspace,
        document_id: vector<u8>,
        content_commitment: vector<u8>,
        origin: u8,
        input_version_ids: vector<ID>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_owner(workspace, ctx);
        assert!(vector::length(&document_id) == ID_BYTES, E_INVALID_DOCUMENT_ID);
        reserve_version(
            workspace,
            document_id,
            option::none(),
            content_commitment,
            origin,
            input_version_ids,
            clock,
            ctx,
        );
    }

    public entry fun reserve_next_version(
        workspace: &mut Workspace,
        previous_version: &Version,
        content_commitment: vector<u8>,
        origin: u8,
        input_version_ids: vector<ID>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_owner(workspace, ctx);
        assert_workspace_version_binding(workspace, previous_version);
        assert!(previous_version.state == STATE_READY, E_PREVIOUS_NOT_READY);
        reserve_version(
            workspace,
            copy previous_version.document_id,
            option::some(previous_version.id.to_inner()),
            content_commitment,
            origin,
            input_version_ids,
            clock,
            ctx,
        );
    }

    public entry fun finalize_version(
        workspace: &mut Workspace,
        version: &mut Version,
        blob_id: vector<u8>,
        ciphertext_digest: vector<u8>,
        storage_end_epoch: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_owner(workspace, ctx);
        assert_workspace_version_binding(workspace, version);
        assert!(version.state == STATE_RESERVED, E_INVALID_STATE);
        assert!(!vector::is_empty(&blob_id), E_INVALID_BLOB);
        assert!(vector::length(&ciphertext_digest) == ID_BYTES, E_INVALID_DIGEST);

        version.blob_id = option::some(copy blob_id);
        version.ciphertext_digest = option::some(copy ciphertext_digest);
        version.storage_end_epoch = option::some(storage_end_epoch);
        version.state = STATE_READY;
        let finalized_at_ms = clock::timestamp_ms(clock);
        version.finalized_at_ms = option::some(finalized_at_ms);
        event::emit(VersionFinalized {
            workspace_id: workspace.id.to_inner(),
            version_id: version.id.to_inner(),
            blob_id,
            ciphertext_digest,
            storage_end_epoch,
            finalized_at_ms,
        });
    }

    public entry fun abandon_version(
        workspace: &mut Workspace,
        version: &mut Version,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_owner(workspace, ctx);
        assert_workspace_version_binding(workspace, version);
        assert!(version.state == STATE_RESERVED, E_INVALID_STATE);
        version.state = STATE_ABANDONED;
        event::emit(VersionAbandoned {
            workspace_id: workspace.id.to_inner(),
            version_id: version.id.to_inner(),
            abandoned_at_ms: clock::timestamp_ms(clock),
        });
    }

    public entry fun grant_read(
        workspace: &mut Workspace,
        version: &Version,
        reader: address,
        expires_at_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_owner(workspace, ctx);
        assert_workspace_version_binding(workspace, version);
        assert!(version.state == STATE_READY, E_INVALID_STATE);
        assert!(expires_at_ms > clock::timestamp_ms(clock), E_INVALID_EXPIRY);
        let grant_revision = upsert_grant(workspace, version.id.to_inner(), reader, expires_at_ms);
        workspace.policy_revision = workspace.policy_revision + 1;
        event::emit(ReadGranted {
            workspace_id: workspace.id.to_inner(),
            version_id: version.id.to_inner(),
            reader,
            expires_at_ms,
            grant_revision,
            policy_revision: workspace.policy_revision,
        });
    }

    public entry fun revoke_read(
        workspace: &mut Workspace,
        version: &Version,
        reader: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert_owner(workspace, ctx);
        assert_workspace_version_binding(workspace, version);
        let grant_revision = revoke_grant(workspace, version.id.to_inner(), reader);
        workspace.policy_revision = workspace.policy_revision + 1;
        event::emit(ReadRevoked {
            workspace_id: workspace.id.to_inner(),
            version_id: version.id.to_inner(),
            reader,
            grant_revision,
            policy_revision: workspace.policy_revision,
            revoked_at_ms: clock::timestamp_ms(clock),
        });
    }

    /// Seal calls this non-public entry. It has no side effects by design.
    entry fun seal_approve(
        id: vector<u8>,
        workspace: &Workspace,
        version: &Version,
        clock: &Clock,
        ctx: &TxContext,
    ) {
        assert!(vector::length(&id) == SEAL_IDENTITY_BYTES, E_INVALID_SEAL_IDENTITY);
        assert!(id == expected_seal_identity(workspace, version), E_INVALID_SEAL_IDENTITY);
        assert!(can_read(workspace, version, tx_context::sender(ctx), clock), E_ACCESS_DENIED);
    }

    public fun workspace_owner(workspace: &Workspace): address { workspace.owner }

    public fun workspace_schema_version(workspace: &Workspace): u64 { workspace.schema_version }

    public fun workspace_policy_revision(workspace: &Workspace): u64 { workspace.policy_revision }

    public fun version_workspace_id(version: &Version): ID { version.workspace_id }

    public fun version_state(version: &Version): u8 { version.state }

    public fun version_is_ready(version: &Version): bool { version.state == STATE_READY }

    public fun expected_seal_identity(workspace: &Workspace, version: &Version): vector<u8> {
        let mut identity = object::uid_to_bytes(&workspace.id);
        vector::append(&mut identity, object::uid_to_bytes(&version.id));
        identity
    }

    public fun can_read(
        workspace: &Workspace,
        version: &Version,
        reader: address,
        clock: &Clock,
    ): bool {
        is_valid_workspace_version_binding(workspace, version)
            && version.state == STATE_READY
            && (reader == workspace.owner || has_active_grant(workspace, version.id.to_inner(), reader, clock::timestamp_ms(clock)))
    }

    fun reserve_version(
        workspace: &mut Workspace,
        document_id: vector<u8>,
        previous_version_id: Option<ID>,
        content_commitment: vector<u8>,
        origin: u8,
        input_version_ids: vector<ID>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(vector::length(&workspace.version_ids) < MAX_VERSIONS, E_VERSION_LIMIT);
        assert!(vector::length(&content_commitment) == ID_BYTES, E_INVALID_COMMITMENT);
        assert_valid_origin_and_inputs(origin, &input_version_ids);
        let reserved_at_ms = clock::timestamp_ms(clock);
        let version = Version {
            id: object::new(ctx),
            workspace_id: workspace.id.to_inner(),
            schema_version: SCHEMA_VERSION,
            document_id: copy document_id,
            previous_version_id: copy previous_version_id,
            creator: tx_context::sender(ctx),
            content_commitment: copy content_commitment,
            state: STATE_RESERVED,
            blob_id: option::none(),
            ciphertext_digest: option::none(),
            storage_end_epoch: option::none(),
            origin,
            input_version_ids,
            reserved_at_ms,
            finalized_at_ms: option::none(),
        };
        let version_id = version.id.to_inner();
        vector::push_back(&mut workspace.version_ids, version_id);
        event::emit(VersionReserved {
            workspace_id: workspace.id.to_inner(),
            version_id,
            schema_version: SCHEMA_VERSION,
            document_id,
            previous_version_id,
            creator: tx_context::sender(ctx),
            content_commitment,
            origin,
            reserved_at_ms,
        });
        transfer::share_object(version);
    }

    fun assert_owner(workspace: &Workspace, ctx: &TxContext) {
        assert!(workspace.schema_version == SCHEMA_VERSION, E_INVALID_SCHEMA);
        assert!(workspace.owner == tx_context::sender(ctx), E_NOT_OWNER);
    }

    fun assert_workspace_version_binding(workspace: &Workspace, version: &Version) {
        assert!(is_valid_workspace_version_binding(workspace, version), E_INVALID_BINDING);
    }

    fun is_valid_workspace_version_binding(workspace: &Workspace, version: &Version): bool {
        workspace.schema_version == SCHEMA_VERSION
            && version.schema_version == SCHEMA_VERSION
            && version.workspace_id == workspace.id.to_inner()
            && workspace_contains_version(workspace, version.id.to_inner())
    }

    fun workspace_contains_version(workspace: &Workspace, version_id: ID): bool {
        let mut i = 0;
        while (i < vector::length(&workspace.version_ids)) {
            if (*vector::borrow(&workspace.version_ids, i) == version_id) return true;
            i = i + 1;
        };
        false
    }

    fun assert_valid_origin_and_inputs(origin: u8, input_version_ids: &vector<ID>) {
        assert!(origin == ORIGIN_USER || origin == ORIGIN_AI, E_INVALID_ORIGIN);
        let length = vector::length(input_version_ids);
        assert!(length <= MAX_INPUT_VERSIONS, E_INVALID_INPUTS);
        if (origin == ORIGIN_USER) assert!(length == 0, E_INVALID_INPUTS);
        if (origin == ORIGIN_AI) assert!(length > 0, E_INVALID_INPUTS);
        assert_no_duplicate_ids(input_version_ids);
    }

    fun assert_no_duplicate_ids(ids: &vector<ID>) {
        let mut i = 0;
        while (i < vector::length(ids)) {
            let mut j = i + 1;
            while (j < vector::length(ids)) {
                assert!(*vector::borrow(ids, i) != *vector::borrow(ids, j), E_INVALID_INPUTS);
                j = j + 1;
            };
            i = i + 1;
        };
    }

    fun upsert_grant(workspace: &mut Workspace, version_id: ID, reader: address, expires_at_ms: u64): u64 {
        let mut i = 0;
        while (i < vector::length(&workspace.grants)) {
            let grant = vector::borrow_mut(&mut workspace.grants, i);
            if (grant.version_id == version_id && grant.reader == reader) {
                grant.expires_at_ms = expires_at_ms;
                grant.revoked = false;
                grant.grant_revision = grant.grant_revision + 1;
                return grant.grant_revision
            };
            i = i + 1;
        };
        assert!(vector::length(&workspace.grants) < MAX_GRANTS, E_GRANT_LIMIT);
        vector::push_back(&mut workspace.grants, Grant {
            version_id,
            reader,
            expires_at_ms,
            revoked: false,
            grant_revision: 1,
        });
        1
    }

    fun revoke_grant(workspace: &mut Workspace, version_id: ID, reader: address): u64 {
        let mut i = 0;
        while (i < vector::length(&workspace.grants)) {
            let grant = vector::borrow_mut(&mut workspace.grants, i);
            if (grant.version_id == version_id && grant.reader == reader) {
                grant.revoked = true;
                grant.grant_revision = grant.grant_revision + 1;
                return grant.grant_revision
            };
            i = i + 1;
        };
        abort E_GRANT_NOT_FOUND
    }

    fun has_active_grant(workspace: &Workspace, version_id: ID, reader: address, now_ms: u64): bool {
        let mut i = 0;
        while (i < vector::length(&workspace.grants)) {
            let grant = vector::borrow(&workspace.grants, i);
            if (grant.version_id == version_id && grant.reader == reader) {
                return !grant.revoked && now_ms < grant.expires_at_ms
            };
            i = i + 1;
        };
        false
    }

    #[test_only]
    public fun test_identity_length(): u64 {
        let mut ctx = tx_context::new_from_hint(@0xA, 1, 0, 0, 0);
        let (workspace, version) = new_test_pair(@0xA, &mut ctx);
        let length = vector::length(&expected_seal_identity(&workspace, &version));
        destroy_test_pair(workspace, version);
        length
    }

    #[test_only]
    public fun test_owner_grant_and_expiry(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 2, 0, 0, 0);
        let mut clock = clock::create_for_testing(&mut ctx);
        let (mut workspace, mut version) = new_test_pair(@0xA, &mut ctx);
        version.state = STATE_READY;
        let version_id = version.id.to_inner();
        upsert_grant(&mut workspace, version_id, @0xB, 10);
        assert!(can_read(&workspace, &version, @0xA, &clock), 100);
        assert!(can_read(&workspace, &version, @0xB, &clock), 101);
        clock::set_for_testing(&mut clock, 10);
        assert!(!can_read(&workspace, &version, @0xB, &clock), 102);
        clock::destroy_for_testing(clock);
        destroy_test_pair(workspace, version);
        true
    }

    #[test_only]
    public fun test_binding_rejects_other_workspace(): bool {
        let mut ctx = tx_context::new_from_hint(@0xA, 3, 0, 0, 0);
        let (workspace, mut version) = new_test_pair(@0xA, &mut ctx);
        let (other_workspace, other_version) = new_test_pair(@0xA, &mut ctx);
        version.workspace_id = other_workspace.id.to_inner();
        assert!(!is_valid_workspace_version_binding(&workspace, &version), 103);
        destroy_test_pair(workspace, version);
        destroy_test_pair(other_workspace, other_version);
        true
    }

    #[test_only]
    public fun test_seal_unauthorized_aborts() {
        let mut owner_ctx = tx_context::new_from_hint(@0xA, 4, 0, 0, 0);
        let reader_ctx = tx_context::new_from_hint(@0xB, 5, 0, 0, 0);
        let clock = clock::create_for_testing(&mut owner_ctx);
        let (workspace, mut version) = new_test_pair(@0xA, &mut owner_ctx);
        version.state = STATE_READY;
        let identity = expected_seal_identity(&workspace, &version);
        seal_approve(identity, &workspace, &version, &clock, &reader_ctx);
        destroy_test_pair(workspace, version);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_double_finalize_aborts() {
        let mut ctx = tx_context::new_from_hint(@0xA, 6, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut workspace, mut version) = new_test_pair(@0xA, &mut ctx);
        let digest = x"0000000000000000000000000000000000000000000000000000000000000000";
        finalize_version(&mut workspace, &mut version, vector[1], digest, 1, &clock, &mut ctx);
        finalize_version(&mut workspace, &mut version, vector[2], digest, 2, &clock, &mut ctx);
        destroy_test_pair(workspace, version);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    public fun test_reserved_next_version_aborts() {
        let mut ctx = tx_context::new_from_hint(@0xA, 7, 0, 0, 0);
        let clock = clock::create_for_testing(&mut ctx);
        let (mut workspace, version) = new_test_pair(@0xA, &mut ctx);
        let commitment = x"0000000000000000000000000000000000000000000000000000000000000000";
        reserve_next_version(&mut workspace, &version, commitment, ORIGIN_USER, vector[], &clock, &mut ctx);
        destroy_test_pair(workspace, version);
        clock::destroy_for_testing(clock);
    }

    #[test_only]
    fun new_test_pair(owner: address, ctx: &mut TxContext): (Workspace, Version) {
        let mut workspace = Workspace {
            id: object::new(ctx),
            owner,
            schema_version: SCHEMA_VERSION,
            policy_revision: 0,
            version_ids: vector[],
            grants: vector[],
        };
        let version = Version {
            id: object::new(ctx),
            workspace_id: workspace.id.to_inner(),
            schema_version: SCHEMA_VERSION,
            document_id: x"0000000000000000000000000000000000000000000000000000000000000000",
            previous_version_id: option::none(),
            creator: owner,
            content_commitment: x"0000000000000000000000000000000000000000000000000000000000000000",
            state: STATE_RESERVED,
            blob_id: option::none(),
            ciphertext_digest: option::none(),
            storage_end_epoch: option::none(),
            origin: ORIGIN_USER,
            input_version_ids: vector[],
            reserved_at_ms: 0,
            finalized_at_ms: option::none(),
        };
        vector::push_back(&mut workspace.version_ids, version.id.to_inner());
        (workspace, version)
    }

    #[test_only]
    fun destroy_test_pair(workspace: Workspace, version: Version) {
        let Workspace {
            id: workspace_id,
            owner: _,
            schema_version: _,
            policy_revision: _,
            version_ids: _,
            grants: _,
        } = workspace;
        let Version {
            id: version_id,
            workspace_id: _,
            schema_version: _,
            document_id: _,
            previous_version_id: _,
            creator: _,
            content_commitment: _,
            state: _,
            blob_id: _,
            ciphertext_digest: _,
            storage_end_epoch: _,
            origin: _,
            input_version_ids: _,
            reserved_at_ms: _,
            finalized_at_ms: _,
        } = version;
        workspace_id.delete();
        version_id.delete();
    }
}
