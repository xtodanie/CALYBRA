# Golden Path 02: File Upload & Ingestion

**Purpose:** Verify bank statement/invoice upload triggers ingestion pipeline.

## Prerequisites
- Logged in as OWNER or ACCOUNTANT
- Active month close in DRAFT status
- Sample CSV (bank statement) and PDF (invoice) files ready

## Steps

### 1. Navigate to Upload
- [ ] Click "Upload" in sidebar
- [ ] **Expected:** Upload page loads with file drop zone

### 2. Upload Bank Statement (CSV)
- [ ] Drag/drop or click to upload `bank_statement.csv`
- [ ] **Expected:** File appears in list with status "PENDING"
- [ ] Wait for processing
- [ ] **Expected:** Status changes to "PROCESSED" or "VERIFIED"

### 3. Verify FileAsset Document
- [ ] Open Firebase Console → Firestore
- [ ] Check `tenants/{tenantId}/monthCloses/{mcId}/fileAssets/{faId}`:
  - `status: "PROCESSED"` or `"VERIFIED"`
  - `fileType` set correctly
  - `tenantId` matches user's tenant

### 4. Verify BankTx Documents Created
- [ ] Check `tenants/{tenantId}/monthCloses/{mcId}/bankTx/` has documents
- [ ] Each bankTx has: `amount`, `date`, `status: "UNMATCHED"`

### 5. Upload Invoice (PDF)
- [ ] Upload `invoice.pdf`
- [ ] **Expected:** File processed, invoice document created

### 6. Verify Invoice Document
- [ ] Check `tenants/{tenantId}/monthCloses/{mcId}/invoices/` has document
- [ ] Invoice has: `amount`, `supplierName`, `status`

## Pass Criteria
- [ ] Both files upload without errors
- [ ] FileAsset documents have correct status
- [ ] BankTx and Invoice documents are created
- [ ] No cross-tenant data visible

## Failure Actions
1. Check Cloud Function logs for `processJob` errors
2. Verify job was created in `jobs/` collection
3. Check `agent/DEBUG_PLAYBOOK.md` for common ingestion issues
