/**
 * E2E Test Script: Call createJob and verify full pipeline execution
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FUNCTIONS_EMULATOR_HOST = '127.0.0.1:5001';

initializeApp({ projectId: 'studio-5801368156-a6af7' });

const db = getFirestore();
const auth = getAuth();

const tenantId = 'testTenant';
const userId = 'testUserUid';
const monthCloseId = '2026-01';
const fileAssetId = 'testFileAsset001';

/**
 * Get a valid ID token from the Auth emulator
 */
async function getIdToken() {
  // Create user in Auth emulator if not exists
  try {
    await auth.createUser({
      uid: userId,
      email: 'test@calybra.com',
    });
    console.log('  Created auth user: ' + userId);
  } catch {
    // User may already exist
    console.log('  Auth user exists: ' + userId);
  }
  
  // Create custom token
  const customToken = await auth.createCustomToken(userId);
  
  // Exchange custom token for ID token via emulator REST API
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
    console.error('Failed to get ID token:', data);
    throw new Error('Could not get ID token from auth emulator');
  }
  return data.idToken;
}

async function callCreateJob() {
  console.log('📋 E2E TEST: Ingestion Pipeline\n');
  console.log('='.repeat(50));
  
  // Step 0: Get proper auth token
  console.log('\n🔹 Step 0: Getting auth token...');
  const idToken = await getIdToken();
  console.log('✓ Got ID token for user: ' + userId);
  
  // Step 1: Call createJob via HTTP (simulating callable)
  console.log('\n🔹 Step 1: Calling createJob...');
  
  const createJobUrl = 'http://127.0.0.1:5001/studio-5801368156-a6af7/us-central1/createJob';
  
  const response = await fetch(createJobUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + idToken,
    },
    body: JSON.stringify({
      data: {
        fileAssetId: fileAssetId,
        monthCloseId: monthCloseId,
      }
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ createJob failed:', response.status, text);
    process.exit(1);
  }

  const result = await response.json();
  console.log('✓ createJob response:', JSON.stringify(result, null, 2));
  
  const jobId = result.result?.jobId;
  if (!jobId) {
    console.error('❌ No jobId in response');
    process.exit(1);
  }
  
  console.log('✓ Job created: ' + jobId);
  
  // Step 2: Wait for job to complete (poll)
  console.log('\n🔹 Step 2: Waiting for job completion...');
  
  let attempts = 0;
  const maxAttempts = 30;
  let finalStatus = 'UNKNOWN';
  
  while (attempts < maxAttempts) {
    const jobSnap = await db.collection('jobs').doc(jobId).get();
    const jobData = jobSnap.data();
    
    if (!jobData) {
      console.error('❌ Job document not found');
      process.exit(1);
    }
    
    const status = jobData.status;
    const progress = jobData.progress;
    console.log(`  [${attempts + 1}/${maxAttempts}] Status: ${status}, Progress: ${progress?.pct}%`);
    
    if (status === 'COMPLETED' || status === 'FAILED') {
      finalStatus = status;
      if (status === 'FAILED') {
        console.log('  Error:', JSON.stringify(jobData.error));
      }
      break;
    }
    
    attempts++;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (finalStatus === 'COMPLETED') {
    console.log('✓ Job completed successfully!');
  } else if (finalStatus === 'FAILED') {
    console.log('❌ Job failed');
  } else {
    console.log('⚠ Job did not complete within timeout');
  }
  
  // Step 3: Verify data creation
  console.log('\n🔹 Step 3: Verifying created data...');
  
  // Check bankTx
  const bankTxSnap = await db.collection('tenants').doc(tenantId).collection('bankTx')
    .where('monthCloseId', '==', monthCloseId).get();
  console.log(`  bankTx documents: ${bankTxSnap.size}`);
  
  const bankTxIds = [];
  bankTxSnap.forEach(doc => {
    const data = doc.data();
    bankTxIds.push(doc.id);
    console.log(`    - ${doc.id}: ${data.amount} (${data.descriptionRaw?.substring(0, 30)})`);
  });
  
  // Check if IDs are deterministic (20 char hex)
  const deterministicPattern = /^[a-f0-9]{20}$/;
  const allDeterministic = bankTxIds.every(id => deterministicPattern.test(id));
  console.log(`  Deterministic IDs: ${allDeterministic ? '✓ YES' : '❌ NO'}`);
  
  // Check matches
  const matchesSnap = await db.collection('tenants').doc(tenantId).collection('matches')
    .where('monthCloseId', '==', monthCloseId).get();
  console.log(`  matches documents: ${matchesSnap.size}`);
  
  // Check exceptions
  const exceptionsSnap = await db.collection('exceptions')
    .where('tenantId', '==', tenantId)
    .where('monthCloseId', '==', monthCloseId).get();
  console.log(`  exceptions documents: ${exceptionsSnap.size}`);
  
  // Check monthClose summary
  const monthCloseSnap = await db.collection('tenants').doc(tenantId)
    .collection('monthCloses').doc(monthCloseId).get();
  const mcData = monthCloseSnap.data();
  console.log('\n  MonthClose summary:');
  console.log(`    bankTotal: ${mcData?.bankTotal}`);
  console.log(`    invoiceTotal: ${mcData?.invoiceTotal}`);
  console.log(`    diff: ${mcData?.diff}`);
  console.log(`    matchCount: ${mcData?.matchCount}`);
  console.log(`    openExceptionsCount: ${mcData?.openExceptionsCount}`);
  
  // Calculate expected bank total
  const expectedBankTotal = 100 + (-50) + 250 + (-75.5) + 500; // 724.50
  console.log(`\n  Expected bankTotal: ${expectedBankTotal}`);
  console.log(`  Actual bankTotal:   ${mcData?.bankTotal}`);
  console.log(`  Match: ${Math.abs((mcData?.bankTotal || 0) - expectedBankTotal) < 0.01 ? '✓ YES' : '❌ NO'}`);
  
  // Step 4: Return job ID for re-run test
  return { jobId, bankTxCount: bankTxSnap.size, bankTxIds, idToken };
}

async function testRerun(jobId, originalBankTxIds, idToken) {
  console.log('\n' + '='.repeat(50));
  console.log('🔹 Step 4: Testing re-run determinism...');
  console.log('='.repeat(50));
  
  // Call retryJob
  console.log('\nCalling retryJob...');
  
  const retryJobUrl = 'http://127.0.0.1:5001/studio-5801368156-a6af7/us-central1/retryJob';
  
  // First set job status to FAILED so we can retry
  await db.collection('jobs').doc(jobId).update({ status: 'FAILED' });
  console.log('  Set job status to FAILED for retry test');
  
  const response = await fetch(retryJobUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + idToken,
    },
    body: JSON.stringify({
      data: { jobId }
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ retryJob failed:', response.status, text);
    process.exit(1);
  }

  const result = await response.json();
  console.log('✓ retryJob response:', JSON.stringify(result, null, 2));
  
  // Wait for completion
  console.log('\nWaiting for retry completion...');
  let attempts = 0;
  while (attempts < 30) {
    const jobSnap = await db.collection('jobs').doc(jobId).get();
    const status = jobSnap.data()?.status;
    console.log(`  [${attempts + 1}/30] Status: ${status}`);
    if (status === 'COMPLETED' || status === 'FAILED') break;
    attempts++;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Check for duplicates
  console.log('\n🔹 Step 5: Checking for duplicates...');
  
  const bankTxSnap = await db.collection('tenants').doc(tenantId).collection('bankTx')
    .where('monthCloseId', '==', monthCloseId).get();
  
  const newBankTxIds = [];
  bankTxSnap.forEach(doc => newBankTxIds.push(doc.id));
  
  console.log(`  Original bankTx count: ${originalBankTxIds.length}`);
  console.log(`  After retry count:     ${newBankTxIds.length}`);
  console.log(`  No duplicates: ${newBankTxIds.length === originalBankTxIds.length ? '✓ YES' : '❌ NO'}`);
  
  // Check IDs are same
  const sameIds = originalBankTxIds.every(id => newBankTxIds.includes(id)) &&
                  newBankTxIds.every(id => originalBankTxIds.includes(id));
  console.log(`  Same IDs: ${sameIds ? '✓ YES' : '❌ NO'}`);
  
  // Check monthClose is stable
  const mcSnap = await db.collection('tenants').doc(tenantId)
    .collection('monthCloses').doc(monthCloseId).get();
  const mcData = mcSnap.data();
  
  const expectedBankTotal = 724.5;
  console.log(`\n  MonthClose bankTotal after retry: ${mcData?.bankTotal}`);
  console.log(`  Expected: ${expectedBankTotal}`);
  console.log(`  Stable: ${Math.abs((mcData?.bankTotal || 0) - expectedBankTotal) < 0.01 ? '✓ YES' : '❌ NO'}`);
}

async function runTests() {
  try {
    const { jobId, bankTxCount, bankTxIds, idToken } = await callCreateJob();
    
    if (bankTxCount > 0) {
      await testRerun(jobId, bankTxIds, idToken);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 E2E TEST COMPLETE');
    console.log('='.repeat(50));
    
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTests();
