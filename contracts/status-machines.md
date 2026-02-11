# Status Machines

## monthCloses.status

Status values:
- DRAFT
- IN_REVIEW
- FINALIZED

Allowed transitions:
- DRAFT → IN_REVIEW
- IN_REVIEW → DRAFT
- IN_REVIEW → FINALIZED

Terminal states:
- FINALIZED

Rules enforce:
- Create requires status "DRAFT".
- Client updates are denied when existing status is "FINALIZED".
- Client CANNOT change status (server-only via transitionMonthClose callable).
- Server transitions must follow allowed transitions.

## fileAssets.status

Status values:
- PENDING_UPLOAD
- UPLOADED
- VERIFIED
- REJECTED
- DELETED

Allowed transitions:
- PENDING_UPLOAD → UPLOADED
- PENDING_UPLOAD → DELETED
- UPLOADED → VERIFIED
- UPLOADED → REJECTED
- UPLOADED → DELETED
- VERIFIED → DELETED
- REJECTED → DELETED

Terminal states:
- DELETED

parseStatus values:
- PENDING
- PARSED
- FAILED

Rules enforce:
- Create requires status "PENDING_UPLOAD".
- If parseStatus is present on create, it must be "PENDING".
- Client CANNOT update/delete fileAssets (server-only).
- Server transitions must follow allowed transitions.

## matches.status

Status values:
- PROPOSED
- CONFIRMED
- REJECTED

Allowed transitions:
- PROPOSED → CONFIRMED
- PROPOSED → REJECTED

Terminal states:
- CONFIRMED
- REJECTED

Rules enforce:
- All match writes are server-only.
- Server transitions must follow allowed transitions.
