
# Calybra MVP - Technical Contracts

## 1. Overview

This document defines the technical contracts required to transition Calybra from an architectural shell to a functional, production-ready Minimum Viable Product (MVP). It is the single source of truth for data flow, security rules, and backend logic. All development must adhere to these contracts.

---

## 2. Phase 1: Security & Data Integrity Lockdown

This is the highest priority. The following Firestore security rules MUST be implemented to ensure data is never accessed or modified inappropriately.

### 2.1. Core Principles

*   **Default Deny:** All paths are closed unless explicitly opened.
*   **Tenant Isolation:** A user may ONLY access data belonging to their `tenantId`. This is non-negotiable.
*   **Server is Authoritative:** Clients cannot create `users` or `tenants`. Critical state transitions (e.g., `job.status`, `match.status`) are server-only operations.

### 2.2. Helper Functions (in `firestore.rules`)

These functions form the basis of our security logic.

*   `isSignedIn()`: Returns `true` if `request.auth != null`.
*   `getUserData()`: Fetches the requesting user's document from `/users/{request.auth.uid}`.
*   `getUserTenantId()`: Returns the `tenantId` from the user's document.
*   `isTenantMember(tenantId)`: Returns `true` if `getUserTenantId() == tenantId`.
*   `isResourceOwner()`: Returns `isTenantMember(resource.data.tenantId)`. Used for read/update/delete.
*   `isRequestingOwner()`: Returns `isTenantMember(request.resource.data.tenantId)`. Used for create.

### 2.3. Collection Rules Contracts

*   `/users/{userId}`
    *   **read:** Allowed if `request.auth.uid == userId`.
    *   **create:** `false`. (Server-only via `onAuthCreate` function).
    *   **update:** Allowed if `request.auth.uid == userId`. Critical fields (`uid`, `email`, `tenantId`, `role`, `plan`, `createdAt`) MUST be immutable.
    *   **delete:** `false`. Users are soft-deleted by updating a `status` field.

*   `/tenants/{tenantId}`
    *   **read:** Allowed if `isTenantMember(tenantId)`.
    *   **create, update, delete:** `false`. (Server-only).

*   **Tenant-Scoped Collections:** The following collections all share the same base rule set.
    *   `monthCloses`
    *   `fileAssets`
    *   `bankTx`
    *   `invoices`
    *   `matches`
    *   `exceptions`
    *   `jobs`
    *   **read:** Allowed if `isSignedIn() && isResourceOwner()`.
    *   **create:** Allowed if `isSignedIn() && isRequestingOwner()`.
    *   **update, delete:** Allowed if `isSignedIn() && isResourceOwner()`.

*   `/auditEvents/{eventId}`
    *   **create:** Allowed if `isSignedIn() && isRequestingOwner()` and `createdAt == request.time`.
    *   **read, update, delete:** `false`. (Append-only).

---

## 3. Phase 2: Live Data Integration (UI Contracts)

All mock data must be removed and replaced with live Firestore queries according to these contracts. All pages must handle loading and empty states gracefully.

*   **`useAuth()` Hook:** Provides `user: User | null`. This object contains `user.tenantId` and `user.activeMonthCloseId`, which are required for all subsequent queries.

*   **`[locale]/month-closes/page.tsx`**
    *   **Query:** `collection('monthCloses')` where `tenantId == user.tenantId`, ordered by `periodStart` descending.
    *   **Render:** The table will be populated with the live data from the query.
    *   **Action (`setActive`):** Clicking "Set active" updates the `activeMonthCloseId` field on the current user's document in the `users` collection.

*   **`[locale]/month-closes/[id]/page.tsx` (Detail Page)**
    *   **Query:** `doc('monthCloses', params.id)`. Must validate `doc.data().tenantId == user.tenantId`.
    *   **Render:** All KPI cards and the workflow panel will be rendered using the live data from the document (`status`, `bankTotal`, `openExceptionsCount`, etc.).

*   **`[locale]/upload/page.tsx`**
    *   **Query 1 (Files):** `collection('fileAssets')` where `monthCloseId == user.activeMonthCloseId`.
    *   **Query 2 (Jobs):** `collection('jobs')` where `monthCloseId == user.activeMonthCloseId`.
    *   **Render:** Use `onSnapshot` for real-time updates to the "Uploaded Files" and "Processing Jobs" lists.
    *   **Action (Upload):** On file upload, creates a `fileAsset` document and a `job` document (e.g., `type: 'PARSE_BANK_CSV'`) in Firestore. This triggers the backend `processJob` function.

*   **`[locale]/matches/page.tsx`**
    *   **Query (Proposed):** `collection('matches')` where `monthCloseId == user.activeMonthCloseId` and `status == 'PROPOSED'`.
    *   **Query (Confirmed):** `collection('matches')` where `monthCloseId == user.activeMonthCloseId` and `status == 'CONFIRMED'`.
    *   **Render:** Tables are populated with live data.
    *   **Action (`Confirm`):** Updates the corresponding `match` document: `status: 'CONFIRMED'`, `confirmedBy: user.uid`, `confirmedAt: serverTimestamp()`. This is a server-side responsibility, so a callable function should be invoked.

*   **`[locale]/exceptions/page.tsx`**
    *   **Query:** `collection('exceptions')` where `monthCloseId == user.activeMonthCloseId` and `status == 'OPEN'`.
    *   **Render:** Table is populated with live data.
    *   **Action (`Resolve`):** Updates the corresponding `exception` document based on the resolution type (e.g., `status: 'RESOLVED'`, `resolvedBy: user.uid`, etc.). This should be handled by a callable function.

---

## 4. Phase 3: Backend Logic Implementation (Function Contracts)

The simulated logic in Cloud Functions must be replaced with real implementations.

*   **`onAuthCreate` Cloud Function (in `calybra-database`)**
    *   **Trigger:** `functions.auth.user().onCreate`.
    *   **Contract:** Atomically creates one `tenant` document and one `user` document in a Firestore transaction. The new `tenant`'s ID is generated uniquely and then assigned to the `tenantId` field of the `user` document. This is the authoritative source of user/tenant creation.

*   **`processJob` Cloud Function (in `functions`)**
    *   **Trigger:** `functions.firestore.document('jobs/{jobId}').onCreate`.
    *   **Contract:** This function acts as a router based on `job.type`.
        *   **`type: 'PARSE_BANK_CSV'`:**
            1.  Downloads the file from Cloud Storage specified in `job.refFileId`.
            2.  Parses the CSV data.
            3.  Creates one `bankTx` document in Firestore for each valid row.
            4.  Updates the parent `fileAsset` status to `PARSED`.
            5.  Updates the `job` status to `COMPLETED`.
            6.  (Optional) Creates a new `SUMMARIZE` job.
        *   **`type: 'PARSE_INVOICE_PDF'`:**
            1.  Downloads the PDF from Cloud Storage.
            2.  Performs OCR to extract text (e.g., using Cloud Vision API).
            3.  Uses a combination of deterministic parsing and the `invoiceParsingWithAi` Genkit flow to extract structured data.
            4.  Creates one `invoice` document in Firestore.
            5.  Updates the `fileAsset` status to `PARSED`.
            6.  Updates the `job` status to `COMPLETED`.
    *   **`type: 'MATCH'` (New Job Type):**
        1.  Queries all `bankTx` and `invoices` for the given `monthCloseId`.
        2.  Runs the reconciliation algorithm.
        3.  Creates `match` documents for successful reconciliations (`status: 'PROPOSED'`).
        4.  Creates `exception` documents for items that fail to match (`status: 'OPEN'`).
    *   **`type: 'SUMMARIZE'` (New Job Type):**
        1.  Recalculates all totals for a `monthClose` (e.g., `bankTotal`, `invoiceTotal`, `openExceptionsCount`).
        2.  Updates the `monthClose` document with the new totals.

*   **`getSignedDownloadUrl` Callable Function (in `functions`)**
    *   **Contract:** Takes a `fileAssetId` as input. Verifies the user is a member of the file's tenant. Returns a short-lived signed URL for downloading the file from Cloud Storage.

---
