#[test_only]
module databounty::databounty_tests;

use databounty::databounty;
use std::unit_test::assert_eq;

#[test]
fun d03_seal_identity_is_exactly_bcs_64_bytes() {
    assert_eq!(databounty::test_identity_length(), 64);
}

#[test]
fun d02_commitment_and_digest_are_fixed_size() {
    assert!(databounty::test_commitment_and_digest_bounds(), 0);
}

#[test]
fun d04_grants_expire_and_revoke_without_inheritance() {
    assert!(databounty::test_grant_expiry_and_revoke(), 0);
}

#[test]
fun d12_reviewer_policy_revision_increments_per_success() {
    assert!(databounty::test_reviewer_policy_revision_increments_per_success(), 0);
}

#[test]
fun d06_parent_substitution_is_rejected() {
    assert!(databounty::test_binding_rejects_parent_substitution(), 0);
}

#[test]
fun d08_reject_returns_open_without_payout() {
    assert!(databounty::test_reject_returns_open_and_clears_ready(), 0);
}

#[test]
fun d11_clock_expiry_boundary_is_inclusive() {
    assert!(databounty::test_expiry_boundary_is_inclusive(), 0);
}

#[test]
fun d11_requester_refund_at_deadline_consumes_escrow() {
    assert!(databounty::test_refund_at_deadline_consumes_escrow(), 0);
}

#[test]
fun d09_terminal_state_is_one_time() {
    assert!(databounty::test_terminal_state_blocks_second_payout(), 0);
}

#[test]
#[expected_failure]
fun d07_non_requester_cannot_pay() {
    databounty::test_unauthorized_approve_aborts();
}

#[test]
#[expected_failure]
fun d09_double_payout_aborts() {
    databounty::test_double_approve_aborts();
}

#[test]
#[expected_failure]
fun d10_ready_submission_blocks_cancel() {
    databounty::test_ready_cancel_aborts();
}

#[test]
#[expected_failure]
fun d11_terminal_bounty_cannot_finalize_reserved_submission() {
    databounty::test_terminal_bounty_cannot_finalize();
}

#[test]
#[expected_failure]
fun d04_unauthorized_seal_request_aborts() {
    databounty::test_seal_unauthorized_aborts();
}

#[test]
#[expected_failure]
fun d11_refund_blocks_fresh_seal_access() {
    databounty::test_refunded_bounty_blocks_fresh_seal_access();
}

#[test]
#[expected_failure]
fun d12_unauthorized_grant_does_not_increment_policy_revision() {
    databounty::test_unauthorized_grant_aborts_without_revision_change();
}

#[test]
#[expected_failure]
fun d12_failed_revoke_does_not_increment_policy_revision() {
    databounty::test_failed_revoke_aborts_without_revision_change();
}
