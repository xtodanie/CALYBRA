# Firestore Schema Contract

## Conventions
- All tenant-owned documents live under tenants/{tenantId}/... and include tenantId.
- Server-authoritative fields must not be set by clients.
- Stored in Firestore as Timestamp; serialized/exported as ISO-8601 strings.
- Roles: OWNER, MANAGER, ACCOUNTANT, VIEWER.

## tenants
**Path:** tenants/{tenantId}

Required fields:
- tenantId: string (must match document id)
- name: string
- ownerId: string
- timezone: string (IANA)
- currency: string (ISO 4217, length 3)
- status: "ACTIVE" | "SUSPENDED"
- createdAt: Timestamp (server)
- updatedAt: Timestamp (server)
- createdBy: string (server)
- updatedBy: string (server)
- schemaVersion: number (server, default 1)

Optional fields:
- billingEmail: string
- settings: object

Server-owned fields:
- createdAt, updatedAt, createdBy, updatedBy, schemaVersion

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- tenantId must equal document id
- tenantId must match user profile tenantId for reads

## users
**Path:** users/{uid}

Required fields:
- uid: string (must match document id)
- tenantId: string
- role: "OWNER" | "MANAGER" | "ACCOUNTANT" | "VIEWER"
- plan: "free" | "pro" | "enterprise"
- status: "active" | "disabled"
- email: string | null
- locale: "en" | "es"
- metadata: object { source: "signup" | "auto-recovery", recoveryCount?: number }
- createdAt: Timestamp (server)
- updatedAt: Timestamp (server)
- createdBy: string (server)
- updatedBy: string (server)
- schemaVersion: number (server, default 1)

Optional fields:
- displayName: string
- activeMonthCloseId: string

Server-owned fields:
- all fields (server-authoritative user provisioning)

Allowed role actions:
- Read: self only
- Write: server-only

Invariants:
- users/{uid}.tenantId is the source of truth for tenant isolation

## monthCloses
**Path:** tenants/{tenantId}/monthCloses/{monthCloseId}

Required fields:
- id: string (must match document id)
- tenantId: string
- periodStart: Timestamp
- periodEnd: Timestamp
- status: "DRAFT" | "IN_REVIEW" | "FINALIZED"
- bankTotal: number
- invoiceTotal: number
- diff: number
- openExceptionsCount: number
- highExceptionsCount: number
- createdBy: string
- createdAt: Timestamp (server)
- updatedAt: Timestamp (server)
- updatedBy: string (server)
- schemaVersion: number (server, default 1)

Optional fields:
- finalizedAt: Timestamp (server)
- finalizedBy: string (server)
- notes: string

Server-owned fields:
- createdAt, updatedAt, updatedBy, finalizedAt, finalizedBy, schemaVersion

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Create: OWNER, MANAGER, ACCOUNTANT
- Update: OWNER, ACCOUNTANT (not when status is FINALIZED)
- Delete: server-only

Invariants:
- FINALIZED monthCloses are immutable

## periods
**Path:** tenants/{tenantId}/periods/{monthKey}

Required fields:
- id: string (must match monthKey)
- tenantId: string
- status: "OPEN" | "FINALIZED"
- schemaVersion: number (server, default 1)

Optional fields:
- finalizedAt: Timestamp (server)
- closeConfig: { asOfDays: number[] }
- periodLockHash: string (server)
- createdAt: Timestamp (server)
- updatedAt: Timestamp (server)
- createdBy: string (server)
- updatedBy: string (server)

Server-owned fields:
- createdAt, updatedAt, createdBy, updatedBy, schemaVersion, finalizedAt, periodLockHash

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- FINALIZED period is immutable unless server updates readmodels/exports

## events
**Path:** tenants/{tenantId}/events/{eventId}

Required fields:
- id: string (must match document id)
- tenantId: string
- type: string (see contract: counterfactual-month-close.contract.md)
- occurredAt: string (ISO)
- recordedAt: string (ISO)
- monthKey: string (YYYY-MM)
- deterministicId: string (idempotency key)
- payload: object (typed per event type)
- schemaVersion: number (server, default 1)

Server-owned fields:
- all fields (server-authoritative)

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- deterministicId must be unique per event

## readmodels
**Path:** tenants/{tenantId}/readmodels/{modelName}/{monthKey}/snapshot

Derived read models (non-authoritative):
- monthCloseTimeline
- closeFriction
- vatSummary
- mismatchSummary

Auditor replay snapshots:
- tenants/{tenantId}/readmodels/auditorReplay/{monthKey}/{asOfDateKey}

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- Readmodels are rebuildable from events

### control-plane readmodels

#### Flight Recorder
**Path:** tenants/{tenantId}/readmodels/flightRecorder/{monthKey}/snapshot

Required fields:
- tenantId: string
- monthKey: string
- activePolicyVersion: string
- heartbeat: object { heartbeatId: string, tenantId: string, escalateToAdaptationScheduler: boolean, reasons: string[] }
- adaptation: object { gate: "observe" | "propose" | "hold", recommendedAction: string }
- timeline: array of objects {
	- decisionId: string
	- contextHash: string
	- policyVersion: string
	- deterministicAction: string
	- aiAction: string
	- whyFired: string
	- changedFromPrevious: string[]
}
- generatedAt: string (ISO)
- schemaVersion: number (server, default 1)

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- Timeline entries are append-only from workflow execution.
- Context hash and policy version must be replay-traceable.

#### Policy Proposals
**Path:** tenants/{tenantId}/readmodels/policyProposals/items/{proposalId}

Required fields:
- proposalId: string
- tenantId: string
- monthKey: string
- pendingPolicyVersion: string
- detectedPattern: string
- impactSimulation: object { estimatedRoiDelta: number, estimatedRiskDelta: number }
- scoringJustification: object
- approvalStatus: "PENDING_APPROVAL" | "APPROVED" | "REJECTED_BY_CANARY"
- createdAt: string (ISO)
- createdBy: string
- schemaVersion: number (server, default 1)

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- Proposals are versioned artifacts; activation is explicit and never automatic.

#### Active Policy Version
**Path:** tenants/{tenantId}/readmodels/policyVersions/items/active

Required fields:
- tenantId: string
- activeVersion: string
- archivedVersion: string
- activationDelta: string
- activatedBy: string
- activatedAt: string (ISO)
- schemaVersion: number (server, default 1)

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- Activation records immutable version lineage and rollback anchor.

#### Control Plane Run Ledger
**Path:** tenants/{tenantId}/readmodels/controlPlaneRuns/items/{monthKey:tier}

Required fields:
- tenantId: string
- monthKey: string
- tier: "nightly" | "weekly"
- heartbeatId: string
- escalated: boolean
- adaptationGate: "observe" | "propose" | "hold"
- updatedAt: string (ISO)
- schemaVersion: number (server, default 1)

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- Run ledger is deterministic, tenant-scoped, and auditable.

## exports
**Path:** tenants/{tenantId}/exports/{monthKey}/artifacts/{artifactId}

Required fields:
- tenantId: string
- monthKey: string
- periodLockHash: string
- contentHash: string (sha256)
- contentType: "text/csv" | "application/pdf"
- filename: string
- generatedAt: string (ISO)
- schemaVersion: number (server, default 1)

Optional fields:
- content: string (CSV)
- contentBase64: string (PDF)

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

## jobs
**Path:** jobs/{jobId}

Required fields:
- id: string (must match document id)
- tenantId: string
- monthKey: string
- action: string
- status: "RUNNING" | "COMPLETED" | "FAILED"
- periodLockHash: string
- startedAt: Timestamp (server)
- schemaVersion: number (server, default 1)

Optional fields:
- completedAt: Timestamp (server)
- outputsRefs: object
- errorCode: string
- errorMessage: string

Allowed role actions:
- Read: tenant members only
- Write: server-only

## exceptions
**Path:** exceptions/{exceptionId}

Required fields:
- tenantId: string
- message: string

Allowed role actions:
- Read: tenant members only
- Write: server-only

## invoices
**Path:** tenants/{tenantId}/invoices/{invoiceId}

Required fields:
- id: string (must match document id)
- tenantId: string
- monthCloseId: string
- supplierNameRaw: string
- invoiceNumber: string
- issueDate: string (YYYY-MM-DD)
- totalGross: number
- extractionConfidence: number (0-100)
- needsReview: boolean
- sourceFileId: string
- createdAt: Timestamp (server)
- updatedAt: Timestamp (server)
- createdBy: string (server)
- updatedBy: string (server)
- schemaVersion: number (server, default 1)

Optional fields:
- supplierId: string

Server-owned fields:
- createdAt, updatedAt, createdBy, updatedBy, schemaVersion

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Create/Update: server-only
- Delete: server-only

Invariants:
- tenantId must match user profile tenantId for reads

## bankTx
**Path:** tenants/{tenantId}/bankTx/{txId}

Required fields:
- id: string (must match document id)
- tenantId: string
- monthCloseId: string
- bookingDate: string (YYYY-MM-DD)
- amount: number
- descriptionRaw: string
- fingerprint: string
- sourceFileId: string
- createdAt: Timestamp (server)
- updatedAt: Timestamp (server)
- createdBy: string (server)
- updatedBy: string (server)
- schemaVersion: number (server, default 1)

Optional fields:
- counterpartyRaw: string
- referenceRaw: string
- counterpartyId: string

Server-owned fields:
- createdAt, updatedAt, createdBy, updatedBy, schemaVersion

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Write: server-only

Invariants:
- tenantId must match user profile tenantId for reads

## matches
**Path:** tenants/{tenantId}/matches/{matchId}

Required fields:
- id: string (must match document id)
- tenantId: string
- monthCloseId: string
- bankTxIds: string[]
- invoiceIds: string[]
- matchType: "EXACT" | "FUZZY" | "GROUPED" | "PARTIAL" | "FEE" | "MANUAL"
- score: number (0-100)
- status: "PROPOSED" | "CONFIRMED" | "REJECTED"
- explanationKey: string
- explanationParams: object
- createdAt: Timestamp (server)
- updatedAt: Timestamp (server)
- createdBy: string (server)
- updatedBy: string (server)
- schemaVersion: number (server, default 1)

Optional fields:
- confirmedBy: string
- confirmedAt: Timestamp
- finalizedBy: string
- reason: string

Server-owned fields:
- createdAt, updatedAt, createdBy, updatedBy, confirmedAt, schemaVersion

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Create/Update: server-only
- Delete: server-only

Invariants:
- bankTxIds and invoiceIds must belong to same tenantId

## fileAssets
**Path:** tenants/{tenantId}/fileAssets/{assetId}

Required fields:
- id: string (must match document id)
- tenantId: string
- monthCloseId: string
- kind: "BANK_CSV" | "INVOICE_PDF" | "EXPORT"
- filename: string
- storagePath: string
- status: "PENDING_UPLOAD"
- createdAt: Timestamp (server)
- updatedAt: Timestamp (server)
- schemaVersion: number (server, default 1)

Optional fields:
- sha256: string (server-owned, set after upload/scan)
- parseStatus: "PENDING"
- parseError: string | null
- parsedAt: Timestamp (server)
- parsedBy: string (server)
- notes: string

Server-owned fields:
- createdAt, updatedAt, parsedAt, parsedBy, sha256, schemaVersion

Allowed role actions:
- Read: OWNER, MANAGER, ACCOUNTANT, VIEWER (tenant members only)
- Create: OWNER, MANAGER, ACCOUNTANT (strict field allowlist)
- Update/Delete: server-only

Invariants:
- tenantId must match user profile tenantId for reads
- status and parseStatus transitions must follow status machines
