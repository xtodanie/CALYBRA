/**
 * STEP 2 — FINALIZATION STATE MACHINE AUDIT
 * 
 * This script validates that finalization is strictly enforced.
 * It is a HARD GATE for accounting integrity.
 * 
 * Assertions:
 * 2.1 Cannot finalize with OPEN exceptions
 * 2.2 Can finalize after resolving all exceptions
 * 2.3 After FINALIZED: retryJob throws
 * 2.4 After FINALIZED: resolveException throws
 * 2.5 After FINALIZED: transitionMatch throws
 * 2.6 After FINALIZED: createJob throws
 * 2.7 Role check: only OWNER can finalize
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FUNCTIONS_EMULATOR_HOST = '127.0.0.1:5001';

initializeApp({ projectId: 'studio-5801368156-a6af7' });

const db = getFirestore();
const auth = getAuth();

const PROJECT_ID = 'studio-5801368156-a6af7';
const FUNCTIONS_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;

// Use unique IDs to avoid collisions with step1 data
const runId = crypto.randomBytes(4).toString('hex');
const tenantId = `finalizeTenant_${runId}`;
const ownerUserId = `finalizeOwner_${runId}`;
const accountantUserId = `finalizeAccountant_${runId}`;
const monthCloseId = '2026-03';

let ownerIdToken = '';
let accountantIdToken = '';

const results = {
  '2.1': { passed: false, message: '' },
  '2.2': { passed: false, message: '' },
  '2.3': { passed: false, message: '' },
  '2.4': { passed: false, message: '' },
  '2.5': { passed: false, message: '' },
  '2.6': { passed: false, message: '' },
  '2.7': { passed: false, message: '' },
};

/**
 * Get a valid ID token from the Auth emulator
 */
async function getIdToken(userId, email) {
  try {
    await auth.createUser({
      uid: userId,
      email: email,
    });
    console.log(`  Created auth user: ${userId}`);
  } catch {
    console.log(`  Auth user exists: ${userId}`);
  }
  
  const customToken = await auth.createCustomToken(userId);
  
  const response = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );
  
  const data = await response.json();
  if (!data.idToken) {
    throw new Error('Could not get ID token from auth emulator');
  }
  return data.idToken;
}

/**
 * Call a Firebase function
 */
async function callFunction(name, data, idToken) {
  const url = `${FUNCTIONS_BASE}/${name}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + idToken,
    },
    body: JSON.stringify({ data }),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    return { ok: false, error: { message: text, status: response.status } };
  }
  
  if (!response.ok) {
    return { ok: false, error: result.error || result };
  }
  
  return { ok: true, result: result.result };
}

/**
 * Seed test data
 */
async function seedTestData() {
  console.log('\n📦 Seeding test data...');
  
  // Create tenant
  await db.collection('tenants').doc(tenantId).set({
    id: tenantId,
    name: 'Finalize Tenant',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create OWNER user
  await db.collection('users').doc(ownerUserId).set({
    id: ownerUserId,
    tenantId,
    role: 'OWNER',
    email: `owner_${runId}@calybra.com`,
    displayName: 'Owner User',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create ACCOUNTANT user
  await db.collection('users').doc(accountantUserId).set({
    id: accountantUserId,
    tenantId,
    role: 'ACCOUNTANT',
    email: `accountant_${runId}@calybra.com`,
    displayName: 'Accountant User',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create monthClose in IN_REVIEW status (can transition to FINALIZED)
  await db.collection('tenants').doc(tenantId).collection('monthCloses').doc(monthCloseId).set({
    id: monthCloseId,
    tenantId,
    status: 'IN_REVIEW',
    bankTotal: 1000,
    invoiceTotal: 1000,
    diff: 0,
    matchCount: 1,
    openExceptionsCount: 1,
    highExceptionsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create 1 bankTx
  const bankTxId = `finalizeBankTx_${runId}`;
  await db.collection('tenants').doc(tenantId).collection('bankTx').doc(bankTxId).set({
    id: bankTxId,
    tenantId,
    monthCloseId,
    amount: 1000,
    bookingDate: '2026-03-15',
    descriptionRaw: 'Test Payment',
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  });

  // Create 1 invoice
  const invoiceId = `finalizeInvoice_${runId}`;
  await db.collection('tenants').doc(tenantId).collection('invoices').doc(invoiceId).set({
    id: invoiceId,
    tenantId,
    monthCloseId,
    totalGross: 1000,
    issueDate: '2026-03-10',
    supplierNameRaw: 'Test Supplier',
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  });

  // Create 1 match (CONFIRMED)
  const matchId = `finalizeMatch_${runId}`;
  await db.collection('tenants').doc(tenantId).collection('matches').doc(matchId).set({
    id: matchId,
    tenantId,
    monthCloseId,
    bankTxIds: [bankTxId],
    invoiceIds: [invoiceId],
    matchType: 'EXACT',
    score: 100,
    status: 'CONFIRMED',
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  });

  // Create 1 exception (OPEN) - blocks finalization
  const exceptionId = `finalizeException_${runId}`;
  await db.collection('exceptions').doc(exceptionId).set({
    id: exceptionId,
    tenantId,
    monthCloseId,
    kind: 'BANK_NO_INVOICE',
    refId: bankTxId,
    refType: 'bankTx',
    severity: 'MEDIUM',
    status: 'OPEN',
    message: 'Test exception',
    sourceJobId: `finalizeJob_${runId}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  });

  // Create job (FAILED for retry test)
  const jobId = `finalizeJob_${runId}`;
  await db.collection('jobs').doc(jobId).set({
    id: jobId,
    tenantId,
    monthCloseId,
    type: 'PARSE_BANK_CSV',
    status: 'FAILED',
    refFileId: `finalizeFile_${runId}`,
    progress: { stepKey: 'jobs.steps.failed', pct: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: ownerUserId,
    schemaVersion: 1,
  });

  // Create fileAsset
  await db.collection('tenants').doc(tenantId).collection('fileAssets').doc(`finalizeFile_${runId}`).set({
    id: `finalizeFile_${runId}`,
    tenantId,
    monthCloseId,
    kind: 'BANK_CSV',
    filename: 'test.csv',
    storagePath: `tenants/${tenantId}/uploads/test.csv`,
    status: 'UPLOADED',
    parseStatus: 'COMPLETED',
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  });

  console.log(`✓ Seeded tenant, users (OWNER + ACCOUNTANT), monthClose, bankTx, invoice, match, exception, job`);
  
  return { bankTxId, invoiceId, matchId, exceptionId, jobId };
}

/**
 * MAIN TEST FLOW
 */
async function runAudit() {
  console.log('🟣 STEP 2 — FINALIZATION STATE MACHINE AUDIT');
  console.log('='.repeat(60));
  
  // Get auth tokens
  console.log('\n🔐 Authenticating...');
  ownerIdToken = await getIdToken(ownerUserId, `owner_${runId}@calybra.com`);
  accountantIdToken = await getIdToken(accountantUserId, `accountant_${runId}@calybra.com`);
  console.log('✓ Authenticated as OWNER and ACCOUNTANT');

  // Seed test data
  const { exceptionId, jobId } = await seedTestData();

  // ==============================================================
  // ASSERTION 2.1: Cannot finalize with OPEN exceptions
  // ==============================================================
  console.log('\n🔹 Assertion 2.1: Cannot finalize with OPEN exceptions');
  
  const finalizeWithOpenResponse = await callFunction('transitionMonthClose', {
    monthCloseId,
    toStatus: 'FINALIZED',
  }, ownerIdToken);

  if (!finalizeWithOpenResponse.ok) {
    const errorMsg = finalizeWithOpenResponse.error?.message || '';
    if (errorMsg.includes('OPEN exception')) {
      results['2.1'] = { passed: true, message: 'Correctly blocked with OPEN exceptions' };
      console.log('  ✓ PASS: Finalization blocked due to OPEN exceptions');
    } else {
      results['2.1'] = { passed: false, message: `Blocked but wrong reason: ${errorMsg}` };
      console.log(`  ❌ FAIL: Blocked but wrong error: ${errorMsg}`);
    }
  } else {
    results['2.1'] = { passed: false, message: 'Finalization was allowed despite OPEN exceptions!' };
    console.log('  ❌ FAIL: Finalization should have been blocked');
  }

  // ==============================================================
  // ASSERTION 2.7: Role check - ACCOUNTANT cannot finalize
  // ==============================================================
  console.log('\n🔹 Assertion 2.7: Role check - ACCOUNTANT cannot finalize');
  
  const accountantFinalizeResponse = await callFunction('transitionMonthClose', {
    monthCloseId,
    toStatus: 'FINALIZED',
  }, accountantIdToken);

  if (!accountantFinalizeResponse.ok) {
    const errorMsg = accountantFinalizeResponse.error?.message || '';
    if (errorMsg.includes('permission') || errorMsg.includes('lacks')) {
      results['2.7'] = { passed: true, message: 'ACCOUNTANT correctly denied finalize permission' };
      console.log('  ✓ PASS: ACCOUNTANT cannot finalize');
    } else {
      results['2.7'] = { passed: false, message: `Denied but wrong reason: ${errorMsg}` };
      console.log(`  ❌ FAIL: Denied but wrong error: ${errorMsg}`);
    }
  } else {
    results['2.7'] = { passed: false, message: 'ACCOUNTANT was allowed to finalize!' };
    console.log('  ❌ FAIL: ACCOUNTANT should not be able to finalize');
  }

  // Resolve the exception to allow finalization
  console.log('\n📝 Resolving exception to allow finalization...');
  await db.collection('exceptions').doc(exceptionId).update({
    status: 'RESOLVED',
    resolvedAt: new Date(),
    resolvedBy: ownerUserId,
  });
  console.log('  ✓ Exception resolved');

  // ==============================================================
  // ASSERTION 2.2: Can finalize after resolving all exceptions
  // ==============================================================
  console.log('\n🔹 Assertion 2.2: Can finalize after resolving all exceptions');
  
  const finalizeResponse = await callFunction('transitionMonthClose', {
    monthCloseId,
    toStatus: 'FINALIZED',
  }, ownerIdToken);

  if (finalizeResponse.ok) {
    results['2.2'] = { passed: true, message: 'Finalization succeeded' };
    console.log('  ✓ PASS: Finalization succeeded');
  } else {
    results['2.2'] = { passed: false, message: `Finalization failed: ${finalizeResponse.error?.message}` };
    console.log(`  ❌ FAIL: Finalization failed: ${finalizeResponse.error?.message}`);
  }

  // Verify monthClose is now FINALIZED
  const mcSnap = await db.collection('tenants').doc(tenantId)
    .collection('monthCloses').doc(monthCloseId).get();
  const mcData = mcSnap.data();
  console.log(`  MonthClose status: ${mcData?.status}`);
  console.log(`  FinalizedAt: ${mcData?.finalizedAt ? 'SET' : 'NOT SET'}`);
  console.log(`  FinalizedBy: ${mcData?.finalizedBy || 'NOT SET'}`);

  // ==============================================================
  // ASSERTION 2.3: After FINALIZED, retryJob throws
  // ==============================================================
  console.log('\n🔹 Assertion 2.3: After FINALIZED, retryJob throws');
  
  const retryResponse = await callFunction('retryJob', {
    jobId,
  }, ownerIdToken);

  if (!retryResponse.ok) {
    const errorMsg = retryResponse.error?.message || '';
    if (errorMsg.includes('FINALIZED')) {
      results['2.3'] = { passed: true, message: 'retryJob correctly blocked after FINALIZED' };
      console.log('  ✓ PASS: retryJob blocked after FINALIZED');
    } else {
      results['2.3'] = { passed: false, message: `Blocked but wrong reason: ${errorMsg}` };
      console.log(`  ❌ FAIL: Blocked but wrong error: ${errorMsg}`);
    }
  } else {
    results['2.3'] = { passed: false, message: 'retryJob was allowed after FINALIZED!' };
    console.log('  ❌ FAIL: retryJob should have been blocked');
  }

  // ==============================================================
  // ASSERTION 2.4: After FINALIZED, resolveException throws
  // ==============================================================
  console.log('\n🔹 Assertion 2.4: After FINALIZED, resolveException throws');
  
  // Create a new OPEN exception for this test
  const newExceptionId = `finalizeExceptionNew_${runId}`;
  await db.collection('exceptions').doc(newExceptionId).set({
    id: newExceptionId,
    tenantId,
    monthCloseId,
    kind: 'BANK_NO_INVOICE',
    refId: `newBankTx_${runId}`,
    refType: 'bankTx',
    severity: 'MEDIUM',
    status: 'OPEN',
    message: 'New test exception',
    sourceJobId: jobId,
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  });

  const resolveResponse = await callFunction('resolveException', {
    exceptionId: newExceptionId,
    action: { type: 'IGNORE', reason: 'Test' },
  }, ownerIdToken);

  if (!resolveResponse.ok) {
    const errorMsg = resolveResponse.error?.message || '';
    if (errorMsg.includes('FINALIZED')) {
      results['2.4'] = { passed: true, message: 'resolveException correctly blocked after FINALIZED' };
      console.log('  ✓ PASS: resolveException blocked after FINALIZED');
    } else {
      results['2.4'] = { passed: false, message: `Blocked but wrong reason: ${errorMsg}` };
      console.log(`  ❌ FAIL: Blocked but wrong error: ${errorMsg}`);
    }
  } else {
    results['2.4'] = { passed: false, message: 'resolveException was allowed after FINALIZED!' };
    console.log('  ❌ FAIL: resolveException should have been blocked');
  }

  // ==============================================================
  // ASSERTION 2.5: After FINALIZED, transitionMatch throws
  // ==============================================================
  console.log('\n🔹 Assertion 2.5: After FINALIZED, transitionMatch throws');
  
  // Create a PROPOSED match for this test
  const newMatchId = `finalizeMatchNew_${runId}`;
  await db.collection('tenants').doc(tenantId).collection('matches').doc(newMatchId).set({
    id: newMatchId,
    tenantId,
    monthCloseId,
    bankTxIds: [`newBankTx_${runId}`],
    invoiceIds: [`newInvoice_${runId}`],
    matchType: 'FUZZY',
    score: 60,
    status: 'PROPOSED',
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  });

  const transitionMatchResponse = await callFunction('transitionMatch', {
    matchId: newMatchId,
    toStatus: 'CONFIRMED',
  }, ownerIdToken);

  if (!transitionMatchResponse.ok) {
    const errorMsg = transitionMatchResponse.error?.message || '';
    if (errorMsg.includes('FINALIZED')) {
      results['2.5'] = { passed: true, message: 'transitionMatch correctly blocked after FINALIZED' };
      console.log('  ✓ PASS: transitionMatch blocked after FINALIZED');
    } else {
      results['2.5'] = { passed: false, message: `Blocked but wrong reason: ${errorMsg}` };
      console.log(`  ❌ FAIL: Blocked but wrong error: ${errorMsg}`);
    }
  } else {
    results['2.5'] = { passed: false, message: 'transitionMatch was allowed after FINALIZED!' };
    console.log('  ❌ FAIL: transitionMatch should have been blocked');
  }

  // ==============================================================
  // ASSERTION 2.6: After FINALIZED, createJob throws
  // ==============================================================
  console.log('\n🔹 Assertion 2.6: After FINALIZED, createJob throws');
  
  const createJobResponse = await callFunction('createJob', {
    fileAssetId: `finalizeFile_${runId}`,
    monthCloseId,
  }, ownerIdToken);

  if (!createJobResponse.ok) {
    const errorMsg = createJobResponse.error?.message || '';
    if (errorMsg.includes('finalized') || errorMsg.includes('FINALIZED')) {
      results['2.6'] = { passed: true, message: 'createJob correctly blocked after FINALIZED' };
      console.log('  ✓ PASS: createJob blocked after FINALIZED');
    } else {
      results['2.6'] = { passed: false, message: `Blocked but wrong reason: ${errorMsg}` };
      console.log(`  ❌ FAIL: Blocked but wrong error: ${errorMsg}`);
    }
  } else {
    results['2.6'] = { passed: false, message: 'createJob was allowed after FINALIZED!' };
    console.log('  ❌ FAIL: createJob should have been blocked');
  }

  // ==============================================================
  // FINAL REPORT
  // ==============================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 STEP 2 AUDIT RESULTS');
  console.log('='.repeat(60));
  
  let allPassed = true;
  for (const [id, result] of Object.entries(results)) {
    const icon = result.passed ? '✓' : '❌';
    console.log(`  ${icon} ${id}: ${result.message}`);
    if (!result.passed) allPassed = false;
  }
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 GATE PASSED: All 7 assertions verified');
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.log('🚫 GATE FAILED: Some assertions failed');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
