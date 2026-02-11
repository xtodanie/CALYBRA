import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
initializeApp({ 
  projectId: 'studio-5801368156-a6af7',
  storageBucket: 'studio-5801368156-a6af7.appspot.com'
});

const bucket = getStorage().bucket();
const [files] = await bucket.getFiles();
console.log('Files in bucket:', files.map(f => f.name));

const testPath = 'tenants/testTenant/monthCloses/2026-01/bank/testFileAsset001.csv';
const file = bucket.file(testPath);
const [exists] = await file.exists();
console.log('Test file exists:', exists, testPath);
