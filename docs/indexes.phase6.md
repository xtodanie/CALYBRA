# Calybra - Firestore Index Plan (Phase 6+)

This document outlines the required composite indexes for backend-heavy queries, primarily for the reconciliation and job processing pipelines. These indexes are essential for performance and must be deployed before the corresponding features are enabled.

---

### 1. `bankTx` Collection

*   **Purpose:** Efficiently fetch all bank transactions for a specific month close during the matching process.
*   **Query Pattern:** `db.collection('bankTx').where('monthCloseId', '==', monthId).where('amount', '>', 0)`
*   **Index Definition:**
    *   Collection: `bankTx`
    *   Fields:
        1.  `monthCloseId` (Ascending)
        2.  `amount` (Ascending)

---

### 2. `invoices` Collection

*   **Purpose:** Efficiently fetch all invoices for a specific month close during the matching process.
*   **Query Pattern:** `db.collection('invoices').where('monthCloseId', '==', monthId).where('totalGross', '>', 0)`
*   **Index Definition:**
    *   Collection: `invoices`
    *   Fields:
        1.  `monthCloseId` (Ascending)
        2.  `totalGross` (Ascending)

---

### 3. `matches` Collection

*   **Purpose:** Query for proposed or confirmed matches within a month.
*   **Query Pattern:** `db.collection('matches').where('monthCloseId', '==', monthId).where('status', '==', 'PROPOSED')`
*   **Index Definition:**
    *   Collection: `matches`
    *   Fields:
        1.  `monthCloseId` (Ascending)
        2.  `status` (Ascending)

---

### 4. `exceptions` Collection

*   **Purpose:** Query for open exceptions of a certain kind within a month.
*   **Query Pattern:** `db.collection('exceptions').where('monthCloseId', '==', monthId).where('status', '==', 'OPEN').where('kind', '==', 'AMOUNT_MISMATCH')`
*   **Index Definition:**
    *   Collection: `exceptions`
    *   Fields:
        1.  `monthCloseId` (Ascending)
        2.  `status` (Ascending)
        3.  `kind` (Ascending)

---
