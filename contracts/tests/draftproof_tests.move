#[test_only]
module draftproof::draftproof_tests;

use draftproof::draftproof;
use std::unit_test::assert_eq;

#[test]
fun seal_identity_is_exactly_64_bytes() {
    assert_eq!(draftproof::test_identity_length(), 64);
}

#[test]
fun owner_and_active_grant_can_read_until_expiry() {
    assert!(draftproof::test_owner_grant_and_expiry(), 0);
}

#[test]
fun workspace_version_substitution_is_rejected() {
    assert!(draftproof::test_binding_rejects_other_workspace(), 0);
}

#[test]
#[expected_failure]
fun unauthorized_seal_request_aborts() {
    draftproof::test_seal_unauthorized_aborts();
}

#[test]
#[expected_failure]
fun ready_version_cannot_be_finalized_twice() {
    draftproof::test_double_finalize_aborts();
}

#[test]
#[expected_failure]
fun next_version_requires_ready_predecessor() {
    draftproof::test_reserved_next_version_aborts();
}
