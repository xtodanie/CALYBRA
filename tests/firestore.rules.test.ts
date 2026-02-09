
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'calybra-test-rules';

// Define user identities for testing
const myAuth = { uid: 'user-owner', email: 'owner@example.com', token: { admin: false } };
const myManagerAuth = { uid: 'user-manager', email: 'manager@example.com', token: { admin: false } };
const myViewerAuth = { uid: 'user-viewer', email: 'viewer@example.com', token: { admin: false } };
const otherTenantAuth = { uid: 'user-other', email: 'other@example.com', token: { admin: false } };
const serverAuth = { uid: 'server-process', email: 'server@example.com', token: { admin: true } }; // Simulates server

// Define resource IDs
const myTenantId = 'tenant-my';
const otherTenantId = 'tenant-other';
const myMonthCloseId = 'month-my';
const myFileAssetId = 'file-my';

// Helper to get a Firestore instance for a given user context
const db = (auth?: { uid: string, token?: { admin: boolean } }) => {
  if (!auth) {
    return testEnv.unauthenticatedContext().firestore();
  }
  return testEnv.authenticatedContext(auth.uid, auth.token).firestore();
};

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { 
        rules: readFileSync("firestore.rules", "utf8"),
        host: '127.0.0.1', 
        port: 8080 
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed initial data using an admin context to bypass security rules for setup
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    // Seed users with roles and tenant assignments
    await setDoc(doc(adminDb, 'users', myAuth.uid), { tenantId: myTenantId, role: 'OWNER' });
    await setDoc(doc(adminDb, 'users', myManagerAuth.uid), { tenantId: myTenantId, role: 'MANAGER' });
    await setDoc(doc(adminDb, 'users', myViewerAuth.uid), { tenantId: myTenantId, role: 'VIEWER' });
    await setDoc(doc(adminDb, 'users', otherTenantAuth.uid), { tenantId: otherTenantId, role: 'OWNER' });

    // Seed tenant-owned data for read/update tests
    await setDoc(doc(adminDb, 'monthCloses', myMonthCloseId), { tenantId: myTenantId, status: 'DRAFT' });
    await setDoc(doc(adminDb, 'monthCloses', 'month-other'), { tenantId: otherTenantId, status: 'DRAFT' });
    await setDoc(doc(adminDb, 'fileAssets', myFileAssetId), { tenantId: myTenantId, status: 'DRAFT' });
  });
});


describe('Calybra Firestore Security Rules', () => {
  
  describe('Unauthenticated Access', () => {
    it('should PREVENT unauthenticated reads to monthCloses', async () => {
      const docRef = doc(db(), 'monthCloses', myMonthCloseId);
      await assertFails(getDoc(docRef));
    });

    it('should PREVENT unauthenticated writes to fileAssets', async () => {
      const docRef = doc(db(), 'fileAssets', 'new-unauth-file');
      await assertFails(setDoc(docRef, { tenantId: myTenantId }));
    });
  });

  describe('Tenant Isolation', () => {
    it('should ALLOW a user to read documents in their own tenant', async () => {
      const docRef = doc(db(myAuth), 'monthCloses', myMonthCloseId);
      await assertSucceeds(getDoc(docRef));
    });

    it('should PREVENT a user from reading documents in another tenant', async () => {
      const docRef = doc(db(myAuth), 'monthCloses', 'month-other');
      await assertFails(getDoc(docRef));
    });

    it('should PREVENT a user from creating a document with a forged tenantId', async () => {
        const fullDocData = {
          tenantId: otherTenantId, // Attempting to write into another tenant
          monthCloseId: "any",
          kind: "INVOICE_PDF",
          filename: "test.pdf",
          storagePath: "/test.pdf",
          sha256: "hash",
          parseStatus: "PENDING",
          status: "DRAFT",
          createdAt: new Date(),
          updatedAt: new Date(),
          schemaVersion: 1
        };
        const docRef = doc(db(myAuth), 'fileAssets', 'cross-tenant-write');
        await assertFails(setDoc(docRef, fullDocData));
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should ALLOW an OWNER to update a draft monthClose', async () => {
      const docRef = doc(db(myAuth), 'monthCloses', myMonthCloseId);
      await assertSucceeds(updateDoc(docRef, { health: 'MATCHED' }));
    });

    it('should PREVENT a VIEWER from updating a monthClose', async () => {
      const docRef = doc(db(myViewerAuth), 'monthCloses', myMonthCloseId);
      await assertFails(updateDoc(docRef, { health: 'MATCHED' }));
    });
  });
  
  describe('Finalize Immutability', () => {
    it('should PREVENT an OWNER from updating a FINALIZED monthClose', async () => {
      // First, finalize the doc as a server/admin to set the state
      const docRef = doc(db(serverAuth), 'monthCloses', myMonthCloseId);
      await updateDoc(docRef, { status: 'FINALIZED' });

      // Then, attempt to update as the owner, which should be denied
      const ownerDocRef = doc(db(myAuth), 'monthCloses', myMonthCloseId);
      await assertFails(updateDoc(ownerDocRef, { health: 'NOT_MATCHED' }));
    });
  });
  
  describe('Client Create Constraints (fileAssets)', () => {
    const validFileAssetData = {
      tenantId: myTenantId,
      monthCloseId: myMonthCloseId,
      kind: "INVOICE_PDF",
      filename: "invoice.pdf",
      storagePath: "path/to/invoice.pdf",
      sha256: "somehash123",
      parseStatus: "PENDING",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: 1
    };

    it('should ALLOW creating a fileAsset with correct initial status and all allowed fields', async () => {
      const docRef = doc(db(myManagerAuth), 'fileAssets', 'new-valid-file');
      await assertSucceeds(setDoc(docRef, validFileAssetData));
    });

    it('should PREVENT creating a fileAsset with a non-pending parseStatus', async () => {
      const docRef = doc(db(myManagerAuth), 'fileAssets', 'new-invalid-status');
      const invalidData = { ...validFileAssetData, parseStatus: 'PARSED' };
      await assertFails(setDoc(docRef, invalidData));
    });

    it('should PREVENT creating a fileAsset with extra, non-allowed fields', async () => {
      const docRef = doc(db(myManagerAuth), 'fileAssets', 'new-extra-fields');
      const invalidData = { ...validFileAssetData, parseError: 'an evil extra field' };
      await assertFails(setDoc(docRef, invalidData));
    });
  });

  describe('Server-Only Collections', () => {
    it('should PREVENT a client from writing to /invoices', async () => {
      const docRef = doc(db(myAuth), 'invoices', 'client-invoice');
      await assertFails(setDoc(docRef, { tenantId: myTenantId, amount: 100 }));
    });

    it('should ALLOW a server to write to /invoices', async () => {
      const docRef = doc(db(serverAuth), 'invoices', 'server-invoice');
      await assertSucceeds(setDoc(docRef, { tenantId: myTenantId, amount: 100 }));
    });

    it('should PREVENT a client from writing to /users', async () => {
      const docRef = doc(db(myAuth), 'users', 'another-user');
      await assertFails(setDoc(docRef, { tenantId: myTenantId, role: 'OWNER' }));
    });
    
    it('should ALLOW a server to write to /users', async () => {
      const docRef = doc(db(serverAuth), 'users', 'new-server-user');
      await assertSucceeds(setDoc(docRef, { tenantId: myTenantId, role: 'VIEWER' }));
    });
  });
});
