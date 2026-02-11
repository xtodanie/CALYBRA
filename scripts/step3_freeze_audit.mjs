/**
 * STEP 3 — FREEZE RULE ENFORCEMENT AUDIT
 * 
 * This script validates that Firestore rules enforce freeze after FINALIZED.
 * Even if callable bugs exist, rules block mutations.
 * 
 * Assertions:
 * 3.1 Server can write invoices BEFORE finalize
 * 3.2 Server CANNOT write invoices AFTER finalize
 * 3.3 Server can write bankTx BEFORE finalize
 * 3.4 Server CANNOT write bankTx AFTER finalize
 * 3.5 Server can write matches BEFORE finalize
 * 3.6 Server CANNOT write matches AFTER finalize
 * 3.7 Server can write exceptions BEFORE finalize
 * 3.8 Server CANNOT write exceptions AFTER finalize
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ID = 'freeze-audit-test';

// Read rules file
const rulesPath = resolve(process.cwd(), 'firestore.rules');
const rules = readFileSync(rulesPath, 'utf8');

const results = {
  '3.1': { passed: false, message: '' },
  '3.2': { passed: false, message: '' },
  '3.3': { passed: false, message: '' },
  '3.4': { passed: false, message: '' },
  '3.5': { passed: false, message: '' },
  '3.6': { passed: false, message: '' },
  '3.7': { passed: false, message: '' },
  '3.8': { passed: false, message: '' },
};

async function runAudit() {
  console.log('🟡 STEP 3 — FREEZE RULE ENFORCEMENT AUDIT');
  console.log('='.repeat(60));

  // Initialize test environment
  console.log('\n📦 Setting up test environment...');
  
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8085,
    },
  });

  // Clear any existing data
  await testEnv.clearFirestore();

  // IDs
  const tenantId = 'freezeTenant';
  const userId = 'freezeUser';
  const monthCloseId = 'freeze-2026-04';
  const invoiceId = 'freezeInvoice';
  const bankTxId = 'freezeBankTx';
  const matchId = 'freezeMatch';
  const exceptionId = 'freezeException';

  // Get server context (admin token)
  const serverDb = testEnv.authenticatedContext(userId, { admin: true }).firestore();

  // Setup: Create tenant, user, and monthClose (DRAFT first)
  console.log('\n📋 Setting up test data...');
  
  // Create user first (rules check this)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    
    // Create user
    await setDoc(doc(db, 'users', userId), {
      id: userId,
      tenantId,
      role: 'OWNER',
      email: 'freeze@calybra.com',
    });

    // Create tenant
    await setDoc(doc(db, 'tenants', tenantId), {
      id: tenantId,
      name: 'Freeze Tenant',
    });

    // Create monthClose in DRAFT status
    await setDoc(doc(db, `tenants/${tenantId}/monthCloses`, monthCloseId), {
      id: monthCloseId,
      tenantId,
      status: 'DRAFT',
      bankTotal: 0,
      invoiceTotal: 0,
    });
  });

  console.log('✓ Created tenant, user, monthClose (DRAFT)');

  // ==============================================================
  // ASSERTIONS 3.1, 3.3, 3.5, 3.7: Server can write BEFORE finalize
  // ==============================================================

  // 3.1: Server can write invoices BEFORE finalize
  console.log('\n🔹 Assertion 3.1: Server can write invoices BEFORE finalize');
  try {
    await assertSucceeds(
      setDoc(doc(serverDb, `tenants/${tenantId}/invoices`, invoiceId), {
        id: invoiceId,
        tenantId,
        monthCloseId,
        totalGross: 1000,
        status: 'ACTIVE',
      })
    );
    results['3.1'] = { passed: true, message: 'Server wrote invoice before finalize' };
    console.log('  ✓ PASS: Server wrote invoice');
  } catch (e) {
    results['3.1'] = { passed: false, message: `Failed: ${e}` };
    console.log(`  ❌ FAIL: ${e}`);
  }

  // 3.3: Server can write bankTx BEFORE finalize
  console.log('\n🔹 Assertion 3.3: Server can write bankTx BEFORE finalize');
  try {
    await assertSucceeds(
      setDoc(doc(serverDb, `tenants/${tenantId}/bankTx`, bankTxId), {
        id: bankTxId,
        tenantId,
        monthCloseId,
        amount: 1000,
      })
    );
    results['3.3'] = { passed: true, message: 'Server wrote bankTx before finalize' };
    console.log('  ✓ PASS: Server wrote bankTx');
  } catch (e) {
    results['3.3'] = { passed: false, message: `Failed: ${e}` };
    console.log(`  ❌ FAIL: ${e}`);
  }

  // 3.5: Server can write matches BEFORE finalize
  console.log('\n🔹 Assertion 3.5: Server can write matches BEFORE finalize');
  try {
    await assertSucceeds(
      setDoc(doc(serverDb, `tenants/${tenantId}/matches`, matchId), {
        id: matchId,
        tenantId,
        monthCloseId,
        bankTxIds: [bankTxId],
        invoiceIds: [invoiceId],
        status: 'PROPOSED',
      })
    );
    results['3.5'] = { passed: true, message: 'Server wrote match before finalize' };
    console.log('  ✓ PASS: Server wrote match');
  } catch (e) {
    results['3.5'] = { passed: false, message: `Failed: ${e}` };
    console.log(`  ❌ FAIL: ${e}`);
  }

  // 3.7: Server can write exceptions BEFORE finalize
  console.log('\n🔹 Assertion 3.7: Server can write exceptions BEFORE finalize');
  try {
    await assertSucceeds(
      setDoc(doc(serverDb, 'exceptions', exceptionId), {
        id: exceptionId,
        tenantId,
        monthCloseId,
        kind: 'BANK_NO_INVOICE',
        refId: bankTxId,
        refType: 'bankTx',
        status: 'OPEN',
      })
    );
    results['3.7'] = { passed: true, message: 'Server wrote exception before finalize' };
    console.log('  ✓ PASS: Server wrote exception');
  } catch (e) {
    results['3.7'] = { passed: false, message: `Failed: ${e}` };
    console.log(`  ❌ FAIL: ${e}`);
  }

  // ==============================================================
  // FINALIZE the monthClose
  // ==============================================================
  console.log('\n🔒 Finalizing monthClose...');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await updateDoc(doc(db, `tenants/${tenantId}/monthCloses`, monthCloseId), {
      status: 'FINALIZED',
      finalizedAt: new Date(),
    });
  });
  console.log('✓ MonthClose status set to FINALIZED');

  // ==============================================================
  // ASSERTIONS 3.2, 3.4, 3.6, 3.8: Server CANNOT write AFTER finalize
  // ==============================================================

  // 3.2: Server CANNOT write invoices AFTER finalize
  console.log('\n🔹 Assertion 3.2: Server CANNOT write invoices AFTER finalize');
  try {
    await assertFails(
      updateDoc(doc(serverDb, `tenants/${tenantId}/invoices`, invoiceId), {
        totalGross: 2000,
        monthCloseId, // Required by rules
      })
    );
    results['3.2'] = { passed: true, message: 'Server blocked from writing invoice after finalize' };
    console.log('  ✓ PASS: Server blocked from invoice write');
  } catch (e) {
    results['3.2'] = { passed: false, message: `Write was allowed or wrong error: ${e}` };
    console.log(`  ❌ FAIL: ${e}`);
  }

  // 3.4: Server CANNOT write bankTx AFTER finalize
  console.log('\n🔹 Assertion 3.4: Server CANNOT write bankTx AFTER finalize');
  try {
    await assertFails(
      updateDoc(doc(serverDb, `tenants/${tenantId}/bankTx`, bankTxId), {
        amount: 2000,
        monthCloseId, // Required by rules
      })
    );
    results['3.4'] = { passed: true, message: 'Server blocked from writing bankTx after finalize' };
    console.log('  ✓ PASS: Server blocked from bankTx write');
  } catch (e) {
    results['3.4'] = { passed: false, message: `Write was allowed or wrong error: ${e}` };
    console.log(`  ❌ FAIL: ${e}`);
  }

  // 3.6: Server CANNOT write matches AFTER finalize
  console.log('\n🔹 Assertion 3.6: Server CANNOT write matches AFTER finalize');
  try {
    await assertFails(
      updateDoc(doc(serverDb, `tenants/${tenantId}/matches`, matchId), {
        status: 'CONFIRMED',
      })
    );
    results['3.6'] = { passed: true, message: 'Server blocked from writing match after finalize' };
    console.log('  ✓ PASS: Server blocked from match write');
  } catch (e) {
    results['3.6'] = { passed: false, message: `Write was allowed or wrong error: ${e}` };
    console.log(`  ❌ FAIL: ${e}`);
  }

  // 3.8: Server CANNOT write exceptions AFTER finalize
  console.log('\n🔹 Assertion 3.8: Server CANNOT write exceptions AFTER finalize');
  try {
    await assertFails(
      updateDoc(doc(serverDb, 'exceptions', exceptionId), {
        status: 'RESOLVED',
      })
    );
    results['3.8'] = { passed: true, message: 'Server blocked from writing exception after finalize' };
    console.log('  ✓ PASS: Server blocked from exception write');
  } catch (e) {
    results['3.8'] = { passed: false, message: `Write was allowed or wrong error: ${e}` };
    console.log(`  ❌ FAIL: ${e}`);
  }

  // Cleanup
  await testEnv.cleanup();

  // ==============================================================
  // FINAL REPORT
  // ==============================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 STEP 3 AUDIT RESULTS');
  console.log('='.repeat(60));
  
  let allPassed = true;
  for (const [id, result] of Object.entries(results)) {
    const icon = result.passed ? '✓' : '❌';
    console.log(`  ${icon} ${id}: ${result.message}`);
    if (!result.passed) allPassed = false;
  }
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 GATE PASSED: All 8 assertions verified');
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
