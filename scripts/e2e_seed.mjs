/**
 * E2E Seed Script for Ingestion Pipeline Testing
 * 
 * Seeds minimum data into Firestore emulator for testing:
 * - Tenant
 * - User profile
 * - MonthClose
 * - FileAsset (with test CSV content)
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

initializeApp({ 
  projectId: 'studio-5801368156-a6af7',
  storageBucket: 'studio-5801368156-a6af7.appspot.com'
});

const db = getFirestore();
const storage = getStorage();

async function seed() {
  console.log('🌱 Seeding E2E test data...\n');

  const tenantId = 'testTenant';
  const userId = 'testUserUid';
  const monthCloseId = '2026-01';

  // 1. Create Tenant
  console.log('Creating tenant...');
  await db.collection('tenants').doc(tenantId).set({
    id: tenantId,
    name: 'Test Tenant',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 1,
  });
  console.log('✓ Tenant created: ' + tenantId);

  // 2. Create User Profile
  console.log('Creating user profile...');
  await db.collection('users').doc(userId).set({
    uid: userId,
    tenantId: tenantId,
    email: 'test@calybra.com',
    role: 'OWNER',
    activeMonthCloseId: monthCloseId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 1,
  });
  console.log('✓ User created: ' + userId);

  // 3. Create MonthClose
  console.log('Creating monthClose...');
  const periodStart = new Date('2026-01-01T00:00:00Z');
  const periodEnd = new Date('2026-01-31T23:59:59Z');
  
  await db.collection('tenants').doc(tenantId).collection('monthCloses').doc(monthCloseId).set({
    id: monthCloseId,
    tenantId: tenantId,
    status: 'DRAFT',
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    bankTotal: 0,
    invoiceTotal: 0,
    diff: 0,
    matchCount: 0,
    openExceptionsCount: 0,
    highExceptionsCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
    schemaVersion: 1,
  });
  console.log('✓ MonthClose created: ' + monthCloseId);

  // 4. Upload test CSV to Storage
  console.log('Uploading test CSV to storage...');
  const csvContent = `Date,Description,Amount
2026-01-02,Stripe Payout,100.00
2026-01-03,Supplier Payment,-50.00
2026-01-05,Client Invoice Payment,250.00
2026-01-10,AWS Services,-75.50
2026-01-15,Monthly Subscription,500.00`;

  const fileAssetId = 'testFileAsset001';
  const storagePath = `tenants/${tenantId}/monthCloses/${monthCloseId}/bank/${fileAssetId}.csv`;
  
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  await file.save(csvContent, { contentType: 'text/csv' });
  console.log('✓ CSV uploaded to: ' + storagePath);

  // 5. Create FileAsset document
  console.log('Creating fileAsset document...');
  await db.collection('tenants').doc(tenantId).collection('fileAssets').doc(fileAssetId).set({
    id: fileAssetId,
    tenantId: tenantId,
    monthCloseId: monthCloseId,
    kind: 'BANK_CSV',
    filename: 'test_bank_statement.csv',
    storagePath: storagePath,
    sha256: 'test-sha256-hash',
    status: 'PENDING_UPLOAD',
    parseStatus: 'PENDING',
    parseError: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 1,
  });
  console.log('✓ FileAsset created: ' + fileAssetId);

  console.log('\n🎉 Seed complete!\n');
  console.log('Summary:');
  console.log('  tenantId:     ' + tenantId);
  console.log('  userId:       ' + userId);
  console.log('  monthCloseId: ' + monthCloseId);
  console.log('  fileAssetId:  ' + fileAssetId);
  console.log('\nNext step: Call createJob callable with these IDs');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
